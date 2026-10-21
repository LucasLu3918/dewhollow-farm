import { expect, test, type Page } from '@playwright/test';

/**
 * 軟體繪圖器的保底（docs/ANIMATION_DESIGN.md「視覺驗收的注意事項」）。
 *
 * 根本原因：Phaser 4.2.1 的多貼圖著色器用 `outTexDatum == float(INDEX)` 對「內插後的 varying」做精確相等比較來選貼圖；
 * SwiftShader 等軟體繪圖器內插「旋轉的方塊」時會有誤差，比較失敗的像素就變透明，角色被切掉一塊。
 * 保底：偵測到軟體繪圖器時，用 Phaser 的官方 API 把每批貼圖數限制為 1，著色器就不再做比較。
 *
 * Playwright 的無頭 Chromium 本身就是 SwiftShader，所以這裡的像素回歸測試在 CI 上是有意義的：沒有保底就會失敗。
 */
interface Compat {
  renderer: string;
  software: boolean;
  workaround: boolean;
  override: string | null;
  textureUnits: number;
  maxTextureUnits: number;
}

async function compat(page: Page): Promise<Compat> {
  return page.evaluate(() => {
    const info = window.__dewhollow?.renderCompat();
    if (!info) throw new Error('缺少 renderCompat 資訊');
    return info;
  });
}

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

/** 擺出走路循環的各個相位，讀 WebGL 畫面，量玩家周圍「非背景」的面積，與靜止姿勢相比。 */
async function areaRatios(page: Page, view: 'down' | 'left'): Promise<number[]> {
  return page.evaluate(async (v) => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow');
    const phases: [number, number][] = [[0, 0], [0, 0.1], [0, 0.2], [0, 0.3], [0, 0.4], [0, 0.5], [0, 0.7], [0, 0.8], [1, 0.25], [1, 0.5], [1, 0.75], [0, 1]];
    async function area(dataUrl: string): Promise<number> {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 116;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('沒有 2D context');
      // 玩家站在畫布 (480, 416)（出生點 (7,9)，鏡頭捲動 (0,224)）
      ctx.drawImage(img, 416, 316, 128, 116, 0, 0, 128, 116);
      const d = ctx.getImageData(0, 0, 128, 116).data;
      const at = 4 * (128 + 1);
      const bg = [d[at] ?? 0, d[at + 1] ?? 0, d[at + 2] ?? 0];
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const diff = Math.abs((d[i] ?? 0) - (bg[0] ?? 0)) + Math.abs((d[i + 1] ?? 0) - (bg[1] ?? 0)) + Math.abs((d[i + 2] ?? 0) - (bg[2] ?? 0));
        if (diff > 60) n += 1;
      }
      return n;
    }
    const ratios: number[] = [];
    let base = 0;
    for (let i = 0; i < phases.length; i += 1) {
      const [step, u] = phases[i] as [number, number];
      debug.setPose(v, step, u);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const a = await area(await debug.snapshot());
      if (i === 0) base = a;
      ratios.push(a / base);
    }
    return ratios;
  }, view);
}

test('turns the workaround on exactly when the renderer is a software one', async ({ page }) => {
  await open(page);
  const info = await compat(page);
  expect(info.renderer.length).toBeGreaterThan(0);
  expect(info.software).toBe(/swiftshader|llvmpipe|softpipe|software|basic render/i.test(info.renderer));
  expect(info.workaround).toBe(info.software);
  expect(info.textureUnits).toBe(info.software ? 1 : info.maxTextureUnits);
});

test('?compat=1 forces the workaround on and ?compat=0 forces it off', async ({ page }) => {
  await open(page, '?compat=1');
  expect(await compat(page)).toMatchObject({ workaround: true, textureUnits: 1, override: 'on' });

  await open(page, '?compat=0');
  const off = await compat(page);
  expect(off).toMatchObject({ workaround: false, override: 'off' });
  expect(off.textureUnits).toBe(off.maxTextureUnits);
  expect(off.maxTextureUnits).toBeGreaterThan(1);
});

// 像素回歸：沒有保底時，SwiftShader 會把旋轉的上半身切掉一塊，面積比掉到 0.67。
for (const view of ['down', 'left'] as const) {
  test(`draws the whole character in every phase of the ${view} walk, even on a software renderer`, async ({ page }) => {
    await open(page);
    const ratios = await areaRatios(page, view);
    expect(ratios).toHaveLength(12);
    for (const [i, ratio] of ratios.entries()) {
      expect(ratio, `${view} 相位 ${i}`).toBeGreaterThan(0.97);
      expect(ratio, `${view} 相位 ${i}`).toBeLessThan(1.03);
    }
  });
}

// 金絲雀：關掉保底時，軟體繪圖器上應該「仍然會壞」。這個測試被標成預期失敗（test.fail）；
// 哪天 Phaser 或 SwiftShader 修好了，它會因為「預期失敗卻通過」而報警，提醒我們可以移除保底（見 render-compat.ts）。
test('canary: without the workaround, a software renderer still breaks (remove the workaround when this starts passing)', async ({ page }) => {
  await open(page, '?compat=0');
  const info = await compat(page);
  test.skip(!info.software, '只有軟體繪圖器才有這個問題');
  test.fail();
  const ratios = await areaRatios(page, 'down');
  for (const [i, ratio] of ratios.entries()) {
    expect(ratio, `down 相位 ${i}`).toBeGreaterThan(0.97);
  }
});
