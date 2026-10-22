import { expect, test, type Page } from '@playwright/test';

/**
 * 觸控操作（M7）：虛擬按鍵（pointer events）直接送出語意動作，直式與橫式都不蓋住遊戲區，
 * 觸控與鍵盤並存，設定可以強制顯示或隱藏。
 */

const SETTINGS_KEY = 'dewhollow-farm.settings';

/** 先寫好偏好再載入頁面（偏好在頁面載入時讀取）。 */
async function seedTouchMode(page: Page, touchControls: 'auto' | 'on' | 'off'): Promise<void> {
  await page.addInitScript(
    ({ key, mode }) => {
      window.localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, touchControls: mode }));
    },
    { key: SETTINGS_KEY, mode: touchControls },
  );
}

async function seedMobileControls(
  page: Page,
  controlStyle: 'dpad' | 'fixed-joystick' | 'floating-joystick',
  handedness: 'right' | 'left' = 'right',
): Promise<void> {
  await page.addInitScript(({ key, style, hand }) => {
    window.localStorage.setItem(key, JSON.stringify({
      schemaVersion: 2,
      settings: { touchControls: 'on', mobile: { controlStyle: style, handedness: hand } },
    }));
  }, { key: SETTINGS_KEY, style: controlStyle, hand: handedness });
}

async function startGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).not.toBe('');
}

/** 點一下虛擬按鍵（用 pointer events 觸發，與觸控裝置送出的事件相同）。 */
async function tapPad(page: Page, action: string): Promise<void> {
  const button = page.locator(`#touch-controls button[data-action="${action}"]`);
  await button.dispatchEvent('pointerdown');
  await button.dispatchEvent('pointerup');
}

async function playerPosition(page: Page): Promise<{ x: number; y: number }> {
  const actors = await page.evaluate(() => window.__dewhollow?.actors() ?? []);
  const player = (actors as { id: string; tileX: number; tileY: number }[]).find((actor) => actor.id === 'player');
  if (!player) throw new Error('找不到玩家');
  return { x: player.tileX, y: player.tileY };
}

async function saveStatePatchAndReload(page: Page, patch: Record<string, unknown>): Promise<void> {
  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
  const record = await page.evaluate(
    () => new Promise<{ slot: string; savedAt: string; state: Record<string, unknown> }>((resolve, reject) => {
      const request = indexedDB.open('dewhollow-farm');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const get = db.transaction('saves').objectStore('saves').get('slot-1');
        get.onsuccess = () => { db.close(); resolve(get.result); };
        get.onerror = () => { db.close(); reject(get.error); };
      };
    }),
  );
  await page.evaluate(
    ({ saved, changes }) => new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('dewhollow-farm');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('saves', 'readwrite');
        tx.objectStore('saves').put({ ...saved, state: { ...saved.state, ...changes } });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    }),
    { saved: record, changes: patch },
  );
  await page.reload();
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).not.toBe('');
}

test.describe('直式手機（390 x 844，觸控）', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('虛擬按鍵顯示在遊戲區的下方，不蓋住畫面', async ({ page }) => {
    await seedTouchMode(page, 'on');
    await startGame(page);
    const pad = page.locator('#touch-controls');
    await expect(pad).toBeVisible();
    const stage = await page.locator('#game').boundingBox();
    const padBox = await pad.boundingBox();
    expect(stage).not.toBeNull();
    expect(padBox).not.toBeNull();
    expect((padBox?.y ?? 0) >= (stage?.y ?? 0) + (stage?.height ?? 0)).toBe(true);
  });

  test('點技能鍵（虛擬）會打開技能面板，與鍵盤 K 相同', async ({ page }) => {
    await seedTouchMode(page, 'on');
    await startGame(page);
    await tapPad(page, 'skills');
    await expect(page.locator('#skill-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#skill-panel')).toBeHidden();
  });

  test('面板開啟時觸控移動被閘門擋下，且開面板只派發一次', async ({ page }) => {
    await seedTouchMode(page, 'on');
    await startGame(page);
    const before = await playerPosition(page);
    await tapPad(page, 'skills');
    await expect(page.locator('#skill-panel')).toBeVisible();
    await tapPad(page, 'moveDown');
    await expect(page.locator('#skill-panel')).toBeVisible();
    expect(await playerPosition(page)).toEqual(before);
    await page.keyboard.press('Escape');
    await expect(page.locator('#skill-panel')).toBeHidden();
  });

  test('改鍵捕捉期間觸控操作不派發遊戲動作', async ({ page }) => {
    await seedTouchMode(page, 'on');
    await startGame(page);
    await page.keyboard.press('o');
    await expect(page.locator('#settings-panel')).toBeVisible();
    await page.locator('#settings-keys button[data-action="interact"]').click();
    const before = await playerPosition(page);
    await tapPad(page, 'moveDown');
    expect(await playerPosition(page)).toEqual(before);
    await expect(page.locator('#settings-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(page.locator('#settings-panel')).toBeHidden();
  });

  test('心形事件開啟時觸控移動被閘門擋下', async ({ page }) => {
    await seedTouchMode(page, 'on');
    await startGame(page);
    await saveStatePatchAndReload(page, { pendingHeartEvent: 'maomao-heart-1' });
    await expect(page.locator('#heart-event-panel')).toBeVisible();
    const before = await playerPosition(page);
    await tapPad(page, 'moveDown');
    expect(await playerPosition(page)).toEqual(before);
    await expect(page.locator('#heart-event-panel')).toBeVisible();
  });

  test('點居民鍵（虛擬）會打開居民面板，點了之後仍可用鍵盤', async ({ page }) => {
    await seedTouchMode(page, 'on');
    await startGame(page);
    await tapPad(page, 'residents');
    await expect(page.locator('#resident-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('k');
    await expect(page.locator('#skill-panel')).toBeVisible();
  });
});

test.describe('橫式手機（844 x 390，觸控）', () => {
  test.use({ hasTouch: true, viewport: { width: 844, height: 390 } });

  test('橫式時方向鍵在遊戲區左側、動作鍵在右側，兩組都不與遊戲區重疊', async ({ page }) => {
    await seedTouchMode(page, 'on');
    await startGame(page);
    const stage = await page.locator('#game').boundingBox();
    expect(stage).not.toBeNull();
    for (const group of ['.touch-move', '.touch-act']) {
      const box = await page.locator(group).boundingBox();
      expect(box, group).not.toBeNull();
      const apart =
        (box?.x ?? 0) + (box?.width ?? 0) <= (stage?.x ?? 0) || (box?.x ?? 0) >= (stage?.x ?? 0) + (stage?.width ?? 0);
      expect(apart, group).toBe(true);
    }
    const move = await page.locator('.touch-move').boundingBox();
    const act = await page.locator('.touch-act').boundingBox();
    expect((move?.x ?? 0) < (stage?.x ?? 0)).toBe(true);
    expect((act?.x ?? 0) > (stage?.x ?? 0)).toBe(true);
  });
});

test.describe('虛擬按鍵的顯示設定', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('設定為隱藏時，即使是觸控裝置也不顯示', async ({ page }) => {
    await seedTouchMode(page, 'off');
    await startGame(page);
    await expect(page.locator('#touch-controls')).toBeHidden();
  });

  test('預設為自動：只有觸控裝置（pointer: coarse）才顯示', async ({ page }) => {
    await startGame(page);
    const coarse = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);
    if (coarse) await expect(page.locator('#touch-controls')).toBeVisible();
    else await expect(page.locator('#touch-controls')).toBeHidden();
  });
});

test.describe('搖桿、多指與生命週期（合成 PointerEvent）', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('設定可選固定／浮動搖桿、慣用手並恢復 D-pad', async ({ page }) => {
    await seedMobileControls(page, 'dpad');
    await startGame(page);
    await page.keyboard.press('o');
    const style = page.locator('#settings-control-style');
    const handedness = page.locator('#settings-handedness');
    await expect(style).toHaveValue('dpad');
    await style.selectOption('fixed-joystick');
    await expect(page.locator('#touch-controls')).toHaveAttribute('data-control-style', 'fixed-joystick');
    await expect(page.locator('.touch-joystick-base')).toBeVisible();
    await style.selectOption('floating-joystick');
    await expect(page.locator('#touch-controls')).toHaveAttribute('data-control-style', 'floating-joystick');
    await handedness.selectOption('left');
    await expect(page.locator('#touch-controls')).toHaveAttribute('data-handedness', 'left');
    await style.selectOption('dpad');
    await expect(page.locator('#touch-controls button[data-action="moveUp"]')).toBeVisible();
    await expect(page.locator('.touch-joystick-base')).toBeHidden();
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), SETTINGS_KEY);
    expect(saved.settings.mobile).toMatchObject({ controlStyle: 'dpad', handedness: 'left' });
  });

  test('floating joystick moves on cardinal axes and stops on pointer cancellation', async ({ page }) => {
    await seedMobileControls(page, 'floating-joystick');
    await startGame(page);
    const before = await playerPosition(page);
    const pad = page.locator('.touch-move');
    const box = await pad.boundingBox();
    expect(box).not.toBeNull();
    const center = { x: (box?.x ?? 0) + (box?.width ?? 0) / 2, y: (box?.y ?? 0) + (box?.height ?? 0) / 2 };
    const send = (type: string, x: number, y: number) => pad.dispatchEvent(type, {
      pointerId: 31,
      pointerType: 'touch',
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    });
    await send('pointerdown', center.x, center.y);
    await send('pointermove', center.x + 58, center.y);
    await expect.poll(async () => (await playerPosition(page)).x).toBeGreaterThan(before.x);
    await send('pointercancel', center.x + 58, center.y);
    const stopped = await playerPosition(page);
    await page.waitForTimeout(350);
    expect(await playerPosition(page)).toEqual(stopped);
  });

  test('releasing the action finger leaves movement active; opening a modal cancels all held gestures', async ({ page }) => {
    await seedMobileControls(page, 'dpad');
    await startGame(page);
    const before = await playerPosition(page);
    const move = page.locator('#touch-controls button[data-action="moveRight"]');
    const action = page.locator('#touch-controls button[data-action="cycleTool"]');
    await move.dispatchEvent('pointerdown', { pointerId: 41, pointerType: 'touch', bubbles: true, cancelable: true });
    await action.dispatchEvent('pointerdown', { pointerId: 42, pointerType: 'touch', bubbles: true, cancelable: true });
    await page.waitForTimeout(360);
    const afterMoving = await playerPosition(page);
    expect(afterMoving.x).toBeGreaterThan(before.x);
    await action.dispatchEvent('pointerup', { pointerId: 42, pointerType: 'touch', bubbles: true, cancelable: true });
    await page.waitForTimeout(240);
    expect((await playerPosition(page)).x).toBeGreaterThan(afterMoving.x);

    const skills = page.locator('#touch-controls button[data-action="skills"]');
    await skills.dispatchEvent('pointerdown', { pointerId: 43, pointerType: 'touch', bubbles: true, cancelable: true });
    await expect(page.locator('#skill-panel')).toBeVisible();
    // The last accepted step may still be animating when the modal opens; let that step settle
    // before checking that cancellation prevented any further repeats.
    await expect.poll(async () => {
      const actors = await page.evaluate(() => window.__dewhollow?.actors() ?? []);
      return (actors as { id: string; busy: boolean }[]).find((actor) => actor.id === 'player')?.busy;
    }).toBe(false);
    const stopped = await playerPosition(page);
    await page.waitForTimeout(350);
    expect(await playerPosition(page)).toEqual(stopped);
    await move.dispatchEvent('pointerup', { pointerId: 41, pointerType: 'touch', bubbles: true, cancelable: true });
    await page.keyboard.press('Escape');
    await expect(page.locator('#skill-panel')).toBeHidden();
  });
});
