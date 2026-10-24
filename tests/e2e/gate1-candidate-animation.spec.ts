import { expect, test } from '@playwright/test';

const previewPath = '/docs/art/candidates/pixel-movement/gate1-assets/pixel32-animation/preview.html';

test('pixel32 candidate animator shows four directions, looping walk and isolated tool impact feedback', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await page.goto(previewPath);

  const canvas = page.locator('#preview-canvas');
  await expect(canvas).toHaveAttribute('data-direction', 'down');
  await expect(canvas).toHaveAttribute('data-motion', 'idle');
  await expect(canvas).toHaveAttribute('data-frame', 'down-idle');

  await page.getByRole('button', { name: '左' }).click();
  await expect(page.getByRole('button', { name: '左' })).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas).toHaveAttribute('data-direction', 'left');
  await page.getByRole('button', { name: '走路' }).click();
  await expect(page.getByRole('button', { name: '走路' })).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas).toHaveAttribute('data-motion', 'walk');
  await expect.poll(async () => canvas.getAttribute('data-frame')).toMatch(/^left-(contact-a|passing|contact-b)$/);

  const toolButton = page.getByRole('button', { name: '揮動工具' });
  await toolButton.click();
  await expect(toolButton).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas).toHaveAttribute('data-motion', 'tool');
  await expect(canvas).toHaveAttribute('data-impact', 'true', { timeout: 1000 });
  await expect(page.locator('#impact-readout')).toContainText('已觸發候選回饋');
  await expect(canvas).toHaveAttribute('data-motion', 'idle', { timeout: 1000 });

  await page.getByLabel('減少動態').check();
  await expect(canvas).toHaveAttribute('data-reduced-motion', 'true');
  await page.getByRole('button', { name: '右' }).click();
  await expect(canvas).toHaveAttribute('data-direction', 'right');
  await expect(page.getByText('此頁只展示 Gate 1 候選幀與工具命中時序')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  expect(failures).toEqual([]);
});

test('reduced-motion preference and control keep walking preview on a stable idle frame', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(previewPath);

  const canvas = page.locator('#preview-canvas');
  await expect(page.getByLabel('減少動態')).toBeChecked();
  await page.getByRole('button', { name: '走路' }).click();
  await expect(canvas).toHaveAttribute('data-motion', 'walk');
  await expect(canvas).toHaveAttribute('data-frame', 'down-idle');
  await page.waitForTimeout(300);
  await expect(canvas).toHaveAttribute('data-frame', 'down-idle');
});
