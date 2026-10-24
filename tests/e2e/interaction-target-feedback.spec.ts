import { expect, test } from '@playwright/test';

test.describe('interaction target feedback', () => {
  test('shows the descriptor cell, tracks turns, and leaves command results unchanged', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.locator('#game canvas')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');

    // Move beside the starting field, then turn right so both descriptors have visible targets.
    for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowUp');
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.interactionTargetMarker().visible ?? false)).toBe(true);
    const facingUp = await page.evaluate(() => ({
      descriptor: window.__dewhollow?.interaction(),
      marker: window.__dewhollow?.interactionTargetMarker(),
    }));
    expect(facingUp.descriptor?.target).not.toBeNull();
    expect(facingUp.marker?.target).toEqual(facingUp.descriptor?.target);
    expect(facingUp.marker).toMatchObject({
      visible: true,
      x: (facingUp.descriptor?.target?.x ?? 0) * 64,
      y: (facingUp.descriptor?.target?.y ?? 0) * 64,
      width: 64,
      height: 64,
    });

    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => page.evaluate(() => {
      const descriptor = window.__dewhollow?.interaction();
      const marker = window.__dewhollow?.interactionTargetMarker();
      return Boolean(descriptor?.target && marker?.visible && marker.target?.x === descriptor.target.x && marker.target?.y === descriptor.target.y);
    })).toBe(true);
    const facingRight = await page.evaluate(() => ({
      descriptor: window.__dewhollow?.interaction(),
      marker: window.__dewhollow?.interactionTargetMarker(),
    }));
    expect(facingRight.descriptor?.target).not.toEqual(facingUp.descriptor?.target);
    expect(facingRight.marker?.target).toEqual(facingRight.descriptor?.target);
    expect(facingRight.marker?.x).toBe((facingRight.descriptor?.target?.x ?? 0) * 64);
    expect(facingRight.marker?.y).toBe((facingRight.descriptor?.target?.y ?? 0) * 64);

    const screenshot = testInfo.outputPath('target-cell-indicator.png');
    await page.screenshot({ path: screenshot });
    await testInfo.attach('target-cell-indicator', { path: screenshot, contentType: 'image/png' });
  });

  test('clears an empty target and keeps the existing no-target command feedback without state changes', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#game canvas')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');

    await expect.poll(() => page.evaluate(() => window.__dewhollow?.interaction().target)).toBeNull();
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.interactionTargetMarker().visible ?? true)).toBe(false);
    const clockBefore = await page.locator('#hud-clock').innerText();
    const energyBefore = await page.locator('#hud-energy-text').innerText();

    await page.keyboard.press('x');
    await expect(page.locator('#hud-log')).toContainText('這裡沒有可以互動的東西');
    await expect(page.locator('#hud-clock')).toHaveText(clockBefore);
    await expect(page.locator('#hud-energy-text')).toHaveText(energyBefore);
    await expect(page.evaluate(() => window.__dewhollow?.interactionTargetMarker().visible ?? true)).resolves.toBe(false);
  });
});
