import { expect, test } from '@playwright/test';

const previewPath = '/docs/art/candidates/pixel-movement/gate1-assets/pixel32-map/preview.html';

test('pixel32 map candidate preview switches seasons and demonstrates topology and occlusion', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const failures: string[] = [];
  const requestFailures: string[] = [];
  const remoteRequests: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('requestfailed', (request) => requestFailures.push(`${request.url()}: ${request.failure()?.errorText ?? 'unknown'}`));
  page.on('request', (request) => { if (!request.url().startsWith('http://127.0.0.1')) remoteRequests.push(request.url()); });
  await page.goto(previewPath);
  await page.waitForTimeout(150);
  expect([...failures, ...requestFailures], 'preview browser errors or failed requests').toEqual([]);

  const canvas = page.locator('#map-preview');
  await expect(canvas).toHaveAttribute('data-season', 'spring');
  await expect(canvas).toHaveAttribute('data-approved', 'false');
  await expect(canvas).toHaveAttribute('data-autotile-mask', /[0-9]+/);
  const houseRoofPixel = await page.evaluate(() => [...(document.querySelector('#map-preview') as HTMLCanvasElement).getContext('2d')!.getImageData(225, 50, 1, 1).data]);
  expect(houseRoofPixel).toEqual([155, 98, 80, 255]);
  await page.getByRole('button', { name: '冬' }).click();
  await expect(canvas).toHaveAttribute('data-season', 'winter');
  await expect(page.locator('#readout')).toContainText('田地邊界遮罩');
  await page.getByLabel('角色走到樹冠後方').uncheck();
  await expect(canvas).toHaveAttribute('data-occlusion', 'in-front');
  await page.getByLabel('角色走到樹冠後方').check();
  await expect(canvas).toHaveAttribute('data-occlusion', 'behind-canopy');

  const screenshotPath = testInfo.outputPath('pixel32-map-candidate-preview.png');
  await canvas.screenshot({ path: screenshotPath });
  await testInfo.attach('pixel32-map-candidate-preview.png', { path: screenshotPath, contentType: 'image/png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  expect(remoteRequests).toEqual([]);
  expect(failures).toEqual([]);
});
