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
async function areaRatios(page: Page, view: 'up' | 'down' | 'left' | 'right'): Promise<number[]> {
  return page.evaluate(async (v) => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少 window.__dewhollow');
    const inspect = debug;
    // 只量玩家自己：旁邊的寵物會被起伏的身體遮住不同的面積，混進量測。
    debug.setOthersHidden(true);
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
      // 玩家世界座標固定在出生點；相機 viewport 會因安全區與控制版位調整，依當前 camera transform 取樣。
      const camera = inspect.cameraView();
      const scroll = inspect.cameraScroll();
      const playerScreenX = camera.x + (480 - scroll.x) * camera.zoom;
      const playerScreenY = camera.y + (640 - scroll.y) * camera.zoom;
      ctx.drawImage(img, playerScreenX - 64, playerScreenY - 100, 128, 116, 0, 0, 128, 116);
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

// 像素回歸：預設 renderer 路徑下，四個朝向的走路相位都必須保持角色完整。
for (const view of ['up', 'down', 'left', 'right'] as const) {
  test(`draws the whole character in every phase of the ${view} walk, even on a software renderer`, async ({ page }, testInfo) => {
    await open(page);
    const info = await compat(page);
    expect(info.workaround).toBe(info.software);
    const ratios = await areaRatios(page, view);
    expect(ratios).toHaveLength(12);
    for (const [i, ratio] of ratios.entries()) {
      expect(ratio, `${view} 相位 ${i}`).toBeGreaterThan(0.97);
      expect(ratio, `${view} 相位 ${i}`).toBeLessThan(1.03);
    }
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const evidence = {
      renderer: info.renderer,
      software: info.software,
      workaround: info.workaround,
      textureUnits: info.textureUnits,
      maxTextureUnits: info.maxTextureUnits,
      browser: userAgent.match(/Chrome\/([^ ]+)/)?.[1] ?? 'unknown',
      view,
      ratios,
      minRatio: Math.min(...ratios),
      maxRatio: Math.max(...ratios),
      threshold: { minExclusive: 0.97, maxExclusive: 1.03 },
    };
    console.log(`[VF13_RENDER_PIXEL] ${JSON.stringify(evidence)}`);
    await testInfo.attach(`renderer-default-${view}.json`, {
      body: `${JSON.stringify(evidence, null, 2)}\n`,
      contentType: 'application/json',
    });
  });
}

// 強制關閉的像素結果只作診斷觀測；通過或出現破損，都不會自動授權移除 runtime 保底。
test('diagnostic: reports forced-off pixel integrity without gating on renderer outcome', async ({ page }, testInfo) => {
  await open(page, '?compat=0');
  const info = await compat(page);
  test.skip(!info.software, '只有軟體繪圖器才有這個問題');
  expect(info).toMatchObject({ workaround: false, override: 'off' });
  const ratios = await areaRatios(page, 'down');
  expect(ratios).toHaveLength(12);
  expect(ratios.every(Number.isFinite)).toBe(true);
  const brokenPhases = ratios.flatMap((ratio, phase) => ratio < 0.97 ? [phase] : []);
  const userAgent = await page.evaluate(() => navigator.userAgent);
  const evidence = {
    renderer: info.renderer,
    software: info.software,
    browser: userAgent.match(/Chrome\/([^ ]+)/)?.[1] ?? 'unknown',
    override: info.override,
    workaround: info.workaround,
    textureUnits: info.textureUnits,
    maxTextureUnits: info.maxTextureUnits,
    view: 'down',
    ratios,
    brokenPhases,
    observation: brokenPhases.length > 0 ? 'forced-off-rendering-shows-integrity-regression' : 'forced-off-rendering-currently-within-threshold',
    note: 'Diagnostic only. Keep the default software-renderer fallback and ?compat=1 unless a separately reviewed cross-renderer change removes them.',
  };
  await testInfo.attach('renderer-forced-off-diagnostic.json', {
    body: `${JSON.stringify(evidence, null, 2)}\n`,
    contentType: 'application/json',
  });
  console.log(`[VF13_RENDER_DIAGNOSTIC] ${JSON.stringify(evidence)}`);
});
