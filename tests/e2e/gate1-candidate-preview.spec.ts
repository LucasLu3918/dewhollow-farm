import { expect, test } from '@playwright/test';

const previewPath = '/docs/art/candidates/pixel-movement/gate1-preview/';
const manifestPath = '/docs/art/candidates/pixel-movement/gate1-assets/manifest.json';

test('Gate 1 candidate preview loads native-grid art without approval or production registration', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  const response = await request.get(manifestPath);
  expect(response.ok()).toBe(true);
  const manifest = await response.json() as {
    status: string;
    approved: boolean;
    candidates: Array<{
      id: string;
      status: string;
      approved: boolean;
      tileSize: number;
      atlas: string;
      sha256: string;
      atlasWidth: number;
      atlasHeight: number;
      frames: Record<string, { x: number; y: number; width: number; height: number; nativeWidth: number; nativeHeight: number; footAnchor: { x: number; y: number } }>;
    }>;
  };
  expect(manifest.status).toBe('candidate');
  expect(manifest.approved).toBe(false);
  expect(manifest.candidates.map(({ id }) => id)).toEqual(['8bit', '16bit']);

  await page.goto(previewPath);
  const expectedKeys = ['grass', 'tilled', 'road', 'tree', 'cropSeed', 'cropSprout', 'cropMature', 'houseEdge', 'fence', 'playerIdle', 'playerWalk', 'cat', 'quokka', 'tool', 'shadow'];
  for (const candidate of manifest.candidates) {
    expect(candidate.status).toBe('candidate');
    expect(candidate.approved).toBe(false);
    expect(candidate.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.keys(candidate.frames)).toEqual(expectedKeys);
    for (const frame of Object.values(candidate.frames)) {
      expect(frame.nativeWidth).toBe(frame.width);
      expect(frame.nativeHeight).toBe(frame.height);
      expect(frame.footAnchor.x).toBeGreaterThanOrEqual(0);
      expect(frame.footAnchor.y).toBeGreaterThanOrEqual(0);
      expect(frame.x).toBeGreaterThanOrEqual(0);
      expect(frame.y).toBeGreaterThanOrEqual(0);
      expect(frame.x + frame.width).toBeLessThanOrEqual(candidate.atlasWidth);
      expect(frame.y + frame.height).toBeLessThanOrEqual(candidate.atlasHeight);
      expect(frame.footAnchor.x).toBeLessThan(frame.width);
      expect(frame.footAnchor.y).toBeLessThan(frame.height);
    }
    const atlas = await page.request.get(`/docs/art/candidates/pixel-movement/gate1-assets/${candidate.atlas}`);
    expect(atlas.ok()).toBe(true);
    expect(atlas.headers()['content-type']).toContain('image/png');
    const integrity = await page.evaluate(async (path) => {
      const bytes = await (await fetch(path)).arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const view = new DataView(bytes);
      return {
        sha256: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
        signature: [...new Uint8Array(bytes, 0, 8)],
        width: view.getUint32(16),
        height: view.getUint32(20),
      };
    }, `/docs/art/candidates/pixel-movement/gate1-assets/${candidate.atlas}`);
    expect(integrity.sha256).toBe(candidate.sha256);
    expect(integrity.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(integrity.width).toBe(candidate.atlasWidth);
    expect(integrity.height).toBe(candidate.atlasHeight);
  }

  await expect(page.getByRole('heading', { name: '同一塊農場，三種像素尺度' })).toBeVisible();
  await expect(page.getByText('尚未接入遊戲玩法，也未獲核准。')).toBeVisible();
  await expect(page.locator('#error-message')).toBeHidden();
  const canvas = page.locator('#farm-preview');

  for (const [id, tileSize] of [['8bit', 16], ['16bit', 32]] as const) {
    await page.getByRole('button', { name: id === '8bit' ? 'A · 8-bit' : 'B · 16-bit' }).click();
    await expect(canvas).toHaveAttribute('data-candidate', id);
    await expect(canvas).toHaveAttribute('data-native-tile-size', String(tileSize));
    await expect(canvas).toHaveAttribute('data-scene-width', '12');
    await expect(canvas).toHaveAttribute('data-scene-height', '10');
    await expect.poll(async () => Number(await canvas.getAttribute('data-rendered-frame-count'))).toBeGreaterThan(0);
    const box = await canvas.boundingBox();
    if (!box) throw new Error(`找不到 ${id} 候選畫布的畫面範圍`);
    const screenshot = await page.screenshot({
      path: test.info().outputPath(`candidate-${id}.png`),
      clip: { x: box.x, y: box.y, width: 384, height: 320 },
    });
    expect(screenshot.readUInt32BE(16)).toBe(384);
    expect(screenshot.readUInt32BE(20)).toBe(320);
    const visual = await canvas.evaluate((element) => {
      const surface = element as HTMLCanvasElement;
      const pixels = surface.getContext('2d')!.getImageData(0, 0, surface.width, surface.height).data;
      const colors = new Set<string>();
      for (let i = 0; i < pixels.length; i += 4 * 97) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
      return { colors: colors.size, width: surface.width, height: surface.height };
    });
    expect(visual.colors).toBeGreaterThan(8);
    expect(visual.width).toBe(384);
    expect(visual.height).toBe(320);
  }

  await page.getByRole('button', { name: '現況' }).click();
  await expect(canvas).toHaveAttribute('data-candidate', 'legacy');
  await expect(page.getByText('現行遊戲截圖，供素材比例參考；它與 A/B 樣張不是同一個遊戲場景。')).toBeVisible();
  await page.getByLabel('顯示比例').selectOption('2');
  await expect(canvas).toHaveCSS('width', '780px');
  await expect(page.locator('#error-message')).toBeHidden();
});
