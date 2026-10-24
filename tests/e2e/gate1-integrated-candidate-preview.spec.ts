import { expect, test } from '@playwright/test';

const previewPath = '/docs/art/candidates/pixel-movement/gate1-assets/integrated-preview.html';
type CandidateManifest = { status: string; approved: boolean; frames: Record<string, { approved?: boolean }> };

test('integrated pixel32 preview composes unapproved animation and map candidates without loading them in production', async ({ page, request }, testInfo) => {
  const requests: string[] = [];
  const failures: string[] = [];
  page.on('request', (requestEvent) => requests.push(new URL(requestEvent.url()).pathname));
  page.on('pageerror', (error) => failures.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(previewPath);

  const canvas = page.locator('#integrated-preview');
  await expect(page.locator('.canvas-scroll')).toHaveJSProperty('scrollWidth', 480);
  await expect(canvas).toHaveAttribute('data-map-candidate', 'pixel32-map');
  await expect(canvas).toHaveAttribute('data-animation-candidate', 'pixel32-animation');
  await expect(canvas).toHaveAttribute('data-approved', 'false');
  await expect(page.locator('#scene-readout')).toContainText('兩組素材均未核准');

  const animationManifest = await request.get('/docs/art/candidates/pixel-movement/gate1-assets/pixel32-animation/manifest.json').then((response) => response.json() as Promise<CandidateManifest>);
  const mapManifest = await request.get('/docs/art/candidates/pixel-movement/gate1-assets/pixel32-map/manifest.json').then((response) => response.json() as Promise<CandidateManifest>);
  expect(animationManifest).toMatchObject({ status: 'candidate', approved: false });
  expect(mapManifest).toMatchObject({ status: 'candidate', approved: false });
  expect(Object.values(animationManifest.frames).every((frame) => frame.approved !== true)).toBe(true);
  expect(Object.values(mapManifest.frames).every((frame: { approved?: boolean }) => frame.approved === false)).toBe(true);

  await page.getByRole('button', { name: '揮動工具' }).click();
  await expect(canvas).toHaveAttribute('data-motion', 'tool');
  await page.getByRole('button', { name: '右', exact: true }).click();
  await expect(page.getByRole('button', { name: '右', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas).toHaveAttribute('data-direction', 'right');
  await expect(canvas).toHaveAttribute('data-motion', 'walk');
  await expect(page.locator('#scene-readout')).toContainText('玩家位置 12,4');
  await page.getByRole('button', { name: '冬', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-season', 'winter');
  await page.getByLabel('角色在樹冠後方').check();
  await expect(canvas).toHaveAttribute('data-occlusion', 'behind-canopy');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.screenshot({ path: testInfo.outputPath('integrated-candidate-preview.png'), fullPage: true });

  const response = await page.goto('/');
  expect(response?.ok()).toBe(true);
  const productionPageRequests = requests.slice(requests.findIndex((path) => path === '/'));
  expect(productionPageRequests.some((path) => path.includes('/pixel32-animation/'))).toBe(false);
  expect(productionPageRequests.some((path) => path.includes('/pixel32-map/'))).toBe(false);
  expect(failures).toEqual([]);
});
