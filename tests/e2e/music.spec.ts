import { expect, test } from '@playwright/test';

/**
 * M3 背景音樂（程式合成，見 content/music.json）：
 * - 預設不播放，玩家按 B 才開始（瀏覽器要求使用者手勢）；再按一次暫停；
 * - 一開始的時間是 06:00 春天，所以選的是春季白天曲；
 * - 按 M 靜音時，音效與音樂一起靜音（沿用同一個靜音旗標）。
 * 狀態見 window.__dewhollow（僅開發模式）。音色只能靠人耳判斷，這裡只檢查狀態。
 * 注意：本檔尚未執行（依任務指示，不在此 worktree 跑 e2e，以免與其他 worktree 搶 5173 port）。
 */
test('music is off until B is pressed, B toggles it, and M mutes it together with the sounds', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');

  expect(await page.evaluate(() => window.__dewhollow?.musicPlaying())).toBe(false);
  expect(await page.evaluate(() => window.__dewhollow?.musicTrack())).toBe('spring.day');

  await page.keyboard.press('b');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.musicPlaying() ?? false)).toBe(true);

  await page.keyboard.press('b');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.musicPlaying() ?? true)).toBe(false);

  await page.keyboard.press('b');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.musicPlaying() ?? false)).toBe(true);

  await page.keyboard.press('m');
  expect(await page.evaluate(() => window.__dewhollow?.muted())).toBe(true);
  expect(await page.evaluate(() => window.__dewhollow?.musicPlaying())).toBe(true);
  await page.keyboard.press('m');
  expect(await page.evaluate(() => window.__dewhollow?.muted())).toBe(false);
});
