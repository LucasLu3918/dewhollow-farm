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

test.describe('MB-06 工具與種子直接選取（合成 pointer input）', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('兩次點擊可直接選取工具或持有的種子，鍵盤仍可循環工具', async ({ page }) => {
    await seedTouchMode(page, 'on');
    await startGame(page);
    await page.locator('#hud-tool').click();
    await expect(page.locator('#tool-seed-panel')).toBeVisible();
    await page.locator('#tool-seed-list [data-selector-id="axe"]').click();
    await expect(page.locator('#hud-tool')).toHaveText('斧頭');

    await page.locator('#hud-seed').click();
    await expect(page.locator('#tool-seed-list [data-selector-id="moon-bean"]')).toBeVisible();
    await page.locator('#tool-seed-list [data-selector-id="moon-bean"]').click();
    await expect(page.locator('#hud-tool')).toHaveText('種子袋');
    await expect(page.locator('#hud-seed')).toContainText('月光豆');
    await page.keyboard.press('z');
    await expect(page.locator('#hud-tool')).toHaveText('鋤頭');
  });

  test('長按後滑到工具項目並放開會直接選取', async ({ page }) => {
    await seedTouchMode(page, 'on');
    await startGame(page);
    const tool = page.locator('#hud-tool');
    await tool.dispatchEvent('pointerdown', { pointerId: 12, pointerType: 'touch', button: 0 });
    await page.waitForTimeout(320);
    await expect(page.locator('#tool-seed-panel')).toBeVisible();
    await expect(page.locator('#tool-seed-title')).toHaveText('工具輪盤');
    const axe = page.locator('#tool-seed-list [data-selector-id="axe"]');
    const axeBox = await axe.boundingBox();
    expect(axeBox).not.toBeNull();
    await page.locator('#tool-seed-list').dispatchEvent('pointermove', {
      pointerId: 12, pointerType: 'touch', buttons: 1,
      clientX: (axeBox?.x ?? 0) + (axeBox?.width ?? 0) / 2,
      clientY: (axeBox?.y ?? 0) + (axeBox?.height ?? 0) / 2,
    });
    await expect(axe).toHaveAttribute('data-wheel-highlighted', 'true');
    await page.locator('#tool-seed-list').dispatchEvent('pointerup', {
      pointerId: 12, pointerType: 'touch', button: 0,
      clientX: (axeBox?.x ?? 0) + (axeBox?.width ?? 0) / 2,
      clientY: (axeBox?.y ?? 0) + (axeBox?.height ?? 0) / 2,
    });
    await expect(page.locator('#tool-seed-panel')).toBeHidden();
    await expect(tool).toHaveText('斧頭');
  });

  test('中心放開不選項目，中心外放開取消；pointercancel 後立刻短按仍開啟清單', async ({ page }) => {
    await seedTouchMode(page, 'on');
    await startGame(page);
    const tool = page.locator('#hud-tool');
    await tool.dispatchEvent('pointerdown', { pointerId: 13, pointerType: 'touch', button: 0 });
    await page.waitForTimeout(320);
    const list = page.locator('#tool-seed-list');
    await list.evaluate((element) => {
      const box = element.getBoundingClientRect();
      element.dispatchEvent(new PointerEvent('pointerup', {
        pointerId: 13, pointerType: 'touch', button: 0, bubbles: true, cancelable: true,
        clientX: box.left + box.width / 2, clientY: box.top + box.height / 2,
      }));
    });
    await expect(page.locator('#tool-seed-panel')).toBeVisible();
    await expect(tool).toHaveText('鋤頭');
    await page.keyboard.press('Escape');

    await tool.dispatchEvent('pointerdown', { pointerId: 14, pointerType: 'touch', button: 0 });
    await page.waitForTimeout(320);
    await page.locator('#tool-seed-list').dispatchEvent('pointerup', {
      pointerId: 14, pointerType: 'touch', button: 0, clientX: 4, clientY: 4,
    });
    await expect(page.locator('#tool-seed-panel')).toBeHidden();

    await tool.dispatchEvent('pointerdown', { pointerId: 15, pointerType: 'touch', button: 0 });
    await page.waitForTimeout(320);
    await tool.dispatchEvent('pointercancel', { pointerId: 15, pointerType: 'touch' });
    await expect(page.locator('#tool-seed-panel')).toBeHidden();
    await tool.click();
    await expect(page.locator('#tool-seed-panel')).toBeVisible();
    await expect(page.locator('#tool-seed-title')).toHaveText('選擇工具');
  });

  test('窄 viewport 的輪盤項目維持在畫面內', async ({ page }) => {
    await seedTouchMode(page, 'on');
    await page.setViewportSize({ width: 320, height: 568 });
    await startGame(page);
    const tool = page.locator('#hud-tool');
    await tool.dispatchEvent('pointerdown', { pointerId: 16, pointerType: 'touch', button: 0 });
    await page.waitForTimeout(320);
    const viewport = page.viewportSize();
    const boxes = await page.locator('#tool-seed-list [data-selector-id]').evaluateAll((buttons) =>
      buttons.map((button) => {
        const box = button.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
      }),
    );
    expect(viewport).not.toBeNull();
    expect(boxes).toHaveLength(7);
    for (const box of boxes) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(viewport?.width ?? 0);
      expect(box.bottom).toBeLessThanOrEqual(viewport?.height ?? 0);
    }
    await page.locator('#tool-seed-list').dispatchEvent('pointercancel', { pointerId: 16, pointerType: 'touch' });
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

  test('left-handed portrait controls stay within the viewport', async ({ page }) => {
    await seedMobileControls(page, 'dpad', 'left');
    await startGame(page);
    const move = await page.locator('.touch-move').boundingBox();
    const actions = await page.locator('.touch-act').boundingBox();
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(move).not.toBeNull();
    expect(actions).not.toBeNull();
    expect((actions?.x ?? Infinity) < (move?.x ?? -Infinity)).toBe(true);
    expect((move?.x ?? 0) + (move?.width ?? 0)).toBeLessThanOrEqual(viewportWidth);
    expect((actions?.x ?? 0) + (actions?.width ?? 0)).toBeLessThanOrEqual(viewportWidth);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('floating joystick moves on cardinal axes and stops on pointer cancellation', async ({ page }) => {
    await seedMobileControls(page, 'floating-joystick');
    await startGame(page);
    const before = await playerPosition(page);
    const pad = page.locator('.touch-move');
    const box = await pad.boundingBox();
    expect(box).not.toBeNull();
    const center = { x: (box?.x ?? 0) + (box?.width ?? 0) / 2, y: (box?.y ?? 0) + (box?.height ?? 0) / 2 };
    const send = (type: string, x: number, y: number, pointerId = 31) => pad.dispatchEvent(type, {
      pointerId,
      pointerType: 'touch',
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    });
    const joystickBase = page.locator('.touch-joystick-base');
    expect(await pad.evaluate((element) => getComputedStyle(element, '::before').width)).toBe('168px');
    await send('pointerdown', box!.x + 20, box!.y + 20, 30);
    const firstBase = await joystickBase.evaluate((element) => ({ left: element.style.left, top: element.style.top }));
    await send('pointercancel', box!.x + 20, box!.y + 20, 30);
    await send('pointerdown', box!.x + 124, box!.y + 124, 32);
    const secondBase = await joystickBase.evaluate((element) => ({ left: element.style.left, top: element.style.top }));
    expect(firstBase).not.toEqual(secondBase);
    await send('pointercancel', box!.x + 124, box!.y + 124, 32);

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
