import { expect, test, type Page } from '@playwright/test';

async function start(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

async function moveToEmptyField(page: Page): Promise<void> {
  for (let i = 0; i < 4; i += 1) await pressMovement(page, 'ArrowLeft');
  for (let i = 0; i < 4; i += 1) await pressMovement(page, 'ArrowUp');
  await pressMovement(page, 'ArrowRight');
}

async function pressMovement(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await expect.poll(() => page.evaluate(() => {
    const movement = window.__dewhollow?.movement();
    return !movement || (!movement.moving && !movement.pending && movement.queuedTaps === 0 && movement.heldDirection === null);
  })).toBe(true);
}

async function enableContinuousActions(page: Page): Promise<void> {
  await page.keyboard.press('o');
  const checkbox = page.locator('#settings-continuous-actions');
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await page.locator('#settings-close').click();
  await expect(page.locator('#settings-panel')).toBeHidden();
}

async function holdMainAction(page: Page, durationMs: number): Promise<void> {
  const box = await page.locator('#hud-action').boundingBox();
  expect(box).not.toBeNull();
  const x = (box?.x ?? 0) + (box?.width ?? 0) / 2;
  const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(durationMs);
  await page.mouse.up();
}

async function dispatchPointerClick(page: Page, pointerId: number): Promise<void> {
  await page.evaluate((id) => {
    document.querySelector<HTMLButtonElement>('#hud-action')!.dispatchEvent(new PointerEvent('click', {
      pointerId: id, pointerType: 'touch', button: 0, bubbles: true, cancelable: true,
    }));
  }, pointerId);
}

async function verifyMultiPointerClicksAreSuppressed(page: Page, order: 'secondary-first' | 'owner-first'): Promise<void> {
  await start(page);
  await moveToEmptyField(page);
  await enableContinuousActions(page);
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('#hud-action')!;
    const bounds = button.getBoundingClientRect();
    const down = (pointerId: number) => new PointerEvent('pointerdown', {
      pointerId, pointerType: 'touch', button: 0, clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2, bubbles: true,
    });
    button.dispatchEvent(down(51));
  });
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.continuousFarmActionsRunning() ?? false)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.effectLog().filter((entry) => entry.name === 'effect:till').length ?? 0)).toBe(1);
  await page.waitForTimeout(1100);
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('#hud-action')!;
    const bounds = button.getBoundingClientRect();
    const init = (type: string, pointerId: number) => new PointerEvent(type, {
      pointerId, pointerType: 'touch', button: 0, clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2, bubbles: true,
    });
    button.dispatchEvent(init('pointerdown', 52));
    button.dispatchEvent(init('pointerup', 52));
    button.dispatchEvent(init('pointerup', 51));
  });
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.continuousFarmActionsRunning() ?? true)).toBe(false);
  const baseline = await page.evaluate(() => ({
    refused: window.__dewhollow?.soundLog().filter((id) => id === 'refuse').length ?? 0,
    till: window.__dewhollow?.effectLog().filter((entry) => entry.name === 'effect:till').length ?? 0,
  }));
  const ids = order === 'secondary-first' ? [52, 51] : [51, 52];
  for (const pointerId of ids) await dispatchPointerClick(page, pointerId);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.soundLog().filter((id) => id === 'refuse').length ?? 0)).toBe(baseline.refused);
  expect(await page.evaluate(() => window.__dewhollow?.effectLog().filter((entry) => entry.name === 'effect:till').length ?? 0)).toBe(baseline.till);
}

async function verifyCancelledPointerCanShortPressAgain(page: Page, cancelBy: 'pointercancel' | 'blur'): Promise<void> {
  await start(page);
  await moveToEmptyField(page);
  await enableContinuousActions(page);
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('#hud-action')!;
    const bounds = button.getBoundingClientRect();
    button.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 61, pointerType: 'touch', button: 0, clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2, bubbles: true,
    }));
  });
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.continuousFarmActionsRunning() ?? false)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.effectLog().filter((entry) => entry.name === 'effect:till').length ?? 0)).toBe(1);
  await page.evaluate((reason) => {
    if (reason === 'blur') {
      window.dispatchEvent(new Event('blur'));
      return;
    }
    document.querySelector<HTMLButtonElement>('#hud-action')!.dispatchEvent(new PointerEvent('pointercancel', {
      pointerId: 61, pointerType: 'touch', bubbles: true,
    }));
  }, cancelBy);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.continuousFarmActionsRunning() ?? true)).toBe(false);
  const refusedBefore = await page.evaluate(() => window.__dewhollow?.soundLog().filter((id) => id === 'refuse').length ?? 0);
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('#hud-action')!;
    const bounds = button.getBoundingClientRect();
    const init = (type: string) => new PointerEvent(type, {
      pointerId: 61, pointerType: 'touch', button: 0, clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2, bubbles: true, cancelable: true,
    });
    button.dispatchEvent(init('pointerdown'));
    button.dispatchEvent(init('pointerup'));
    button.dispatchEvent(init('click'));
  });
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.soundLog().filter((id) => id === 'refuse').length ?? 0)).toBe(refusedBefore + 1);
}

async function saveGame(page: Page): Promise<void> {
  await page.keyboard.press('s');
  await expect(page.locator('#hud-log')).toContainText('已存檔');
}

async function savedRecord(page: Page): Promise<{ state: Record<string, unknown>; [key: string]: unknown }> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction('saves').objectStore('saves').get('slot-1');
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    };
  })) as Promise<{ state: Record<string, unknown>; [key: string]: unknown }>;
}

async function prepareFarmState(page: Page, configure: (state: Record<string, unknown>) => void): Promise<{ state: Record<string, unknown>; [key: string]: unknown }> {
  await start(page);
  await saveGame(page);
  const record = await savedRecord(page);
  configure(record.state);
  await restoreRecord(page, record);
  await page.reload();
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  return record;
}

async function restoreRecord(page: Page, record: unknown): Promise<void> {
  await page.evaluate((value) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(value);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }), record);
}

test.describe('可取消的長按連續農務', () => {
  test('設定預設關閉；關閉時長按只在放開後執行一次原本動作', async ({ page }) => {
    await start(page);
    await moveToEmptyField(page);
    await page.keyboard.press('o');
    await expect(page.locator('#settings-continuous-actions')).not.toBeChecked();
    await page.locator('#settings-close').click();

    await holdMainAction(page, 420);
    await expect.poll(async () => page.evaluate(() => window.__dewhollow?.effectLog().filter((entry) => entry.name === 'effect:till').length ?? 0)).toBe(1);
  });

  test('啟用後放開會取消尚未執行的重複工作，等待命中動畫結束也不會重複同格', async ({ page }) => {
    await start(page);
    await moveToEmptyField(page);
    await enableContinuousActions(page);

    // Synthetic mouse pointer lifecycle; release after the first command starts but before its swing completes.
    await holdMainAction(page, 330);
    await page.waitForTimeout(550);
    const hits = await page.evaluate(() => window.__dewhollow?.effectLog().filter((entry) => entry.name === 'effect:till').length ?? 0);
    expect(hits).toBe(1);
  });

  test('第二個 pointer 不接管或取消第一個 pointer 的長按農務', async ({ page }) => {
    await start(page);
    await moveToEmptyField(page);
    await enableContinuousActions(page);
    await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>('#hud-action')!;
      const bounds = button.getBoundingClientRect();
      const init = (pointerId: number) => new PointerEvent('pointerdown', {
        pointerId, pointerType: 'touch', button: 0, clientX: bounds.left + bounds.width / 2,
        clientY: bounds.top + bounds.height / 2, bubbles: true,
      });
      button.dispatchEvent(init(41));
      window.setTimeout(() => {
        const currentBounds = button.getBoundingClientRect();
        const initSecondary = (type: string) => new PointerEvent(type, {
          pointerId: 42, pointerType: 'touch', button: 0,
          clientX: currentBounds.left + currentBounds.width / 2,
          clientY: currentBounds.top + currentBounds.height / 2, bubbles: true,
        });
        button.dispatchEvent(initSecondary('pointerdown'));
        button.dispatchEvent(initSecondary('pointerup'));
      }, 285);
    });
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.effectLog().filter((entry) => entry.name === 'effect:till').length ?? 0), { timeout: 10_000 }).toBe(1);
    await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>('#hud-action')!;
      button.dispatchEvent(new PointerEvent('pointerup', { pointerId: 41, pointerType: 'touch', bubbles: true }));
    });
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.continuousFarmActionsRunning() ?? true)).toBe(false);
    await page.waitForTimeout(700);
    const hits = await page.evaluate(() => window.__dewhollow?.effectLog().filter((entry) => entry.name === 'effect:till').length ?? 0);
    expect(hits).toBe(1);
  });

  test('secondary click 先到時不消耗 owner click 的抑制，兩者都不 dispatch', async ({ page }) => {
    await verifyMultiPointerClicksAreSuppressed(page, 'secondary-first');
  });

  test('owner click 先到時也不讓 secondary click dispatch', async ({ page }) => {
    await verifyMultiPointerClicksAreSuppressed(page, 'owner-first');
  });

  test('pointercancel 後相同 pointerId 可立即短按', async ({ page }) => {
    await verifyCancelledPointerCanShortPressAgain(page, 'pointercancel');
  });

  test('blur 後相同 pointerId 可立即短按', async ({ page }) => {
    await verifyCancelledPointerCanShortPressAgain(page, 'blur');
  });

  test('持續移動會重新查詢面前田地；舊田不重做且新田可執行', async ({ page }) => {
    await start(page);
    await moveToEmptyField(page);
    await enableContinuousActions(page);
    const action = page.locator('#hud-action');
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    const clientX = (box?.x ?? 0) + (box?.width ?? 0) / 2;
    const clientY = (box?.y ?? 0) + (box?.height ?? 0) / 2;
    const playerBeforeMove = await page.evaluate(() => {
      const player = window.__dewhollow?.actors().find((actor) => actor.id === 'player');
      return player ? { x: player.tileX, y: player.tileY } : null;
    });
    await page.evaluate(() => {
      const moveDuringSwing = (): void => {
        const hits = window.__dewhollow?.effectLog().filter((entry) => entry.name === 'effect:till').length ?? 0;
        if (hits === 0) {
          requestAnimationFrame(moveDuringSwing);
          return;
        }
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true,
        }));
        window.dispatchEvent(new KeyboardEvent('keyup', {
          key: 'ArrowRight', code: 'ArrowRight', bubbles: true, cancelable: true,
        }));
      };
      requestAnimationFrame(moveDuringSwing);
    });
    await page.mouse.move(clientX, clientY);
    await page.mouse.down();
    await expect.poll(() => page.evaluate(() => {
      const player = window.__dewhollow?.actors().find((actor) => actor.id === 'player');
      return player ? `${player.tileX},${player.tileY}` : '';
    })).not.toBe(`${playerBeforeMove?.x},${playerBeforeMove?.y}`);
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.effectLog().filter((entry) => entry.name === 'effect:till').length ?? 0), { timeout: 5000 }).toBe(2);
    await expect.poll(() => page.evaluate(() => {
      const candidate = window.__dewhollow?.interaction();
      return `${candidate?.labelKey}:${candidate?.plotKey}`;
    })).toBe('alreadyTilled:6,5');
    await page.waitForTimeout(800);
    await page.mouse.up();
    const hits = await page.evaluate(() => window.__dewhollow?.effectLog().filter((entry) => entry.name === 'effect:till').length ?? 0);
    expect(hits).toBe(2);
  });

  test('pointerleave 在長按啟動後立即停止未執行工作', async ({ page }) => {
    await start(page);
    await moveToEmptyField(page);
    await enableContinuousActions(page);
    const action = page.locator('#hud-action');
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    await page.evaluate(() => {
      const button = document.querySelector('#hud-action')!;
      button.addEventListener('pointerleave', () => undefined);
    });
    const clientX = (box?.x ?? 0) + (box?.width ?? 0) / 2;
    const clientY = (box?.y ?? 0) + (box?.height ?? 0) / 2;
    await page.mouse.move(clientX, clientY);
    await page.mouse.down();
    await page.evaluate(() => new Promise<void>((resolve) => {
      const button = document.querySelector('#hud-action')!;
      const poll = (): void => {
        if (window.__dewhollow?.continuousFarmActionsRunning()) {
          button.dispatchEvent(new PointerEvent('pointerleave', {
            pointerId: 1, pointerType: 'mouse', clientX: 2, clientY: 2, bubbles: true,
          }));
          resolve();
          return;
        }
        window.setTimeout(poll, 0);
      };
      poll();
    }));
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.continuousFarmActionsRunning() ?? true)).toBe(false);
    await page.mouse.up();
    await page.waitForTimeout(900);
    const hits = await page.evaluate(() => window.__dewhollow?.effectLog().filter((entry) => entry.name === 'effect:till').length ?? 0);
    expect(hits).toBeLessThanOrEqual(1);
  });

  test('單次互動與長按農務經原有 command 路徑產生相同終態', async ({ page }) => {
    await start(page);
    await moveToEmptyField(page);
    await enableContinuousActions(page);
    await saveGame(page);
    const initial = await savedRecord(page);

    await page.locator('#hud-action').click();
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.effectLog().filter((entry) => entry.name === 'effect:till').length ?? 0)).toBe(1);
    await expect.poll(async () => page.evaluate(() => window.__dewhollow?.actors().find((actor) => actor.id === 'player')?.busy ?? true)).toBe(false);
    await saveGame(page);
    const singleAction = await savedRecord(page);

    await restoreRecord(page, initial);
    await page.reload();
    await expect(page.locator('#game canvas')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
    await holdMainAction(page, 900);
    await expect.poll(async () => page.evaluate(() => window.__dewhollow?.actors().find((actor) => actor.id === 'player')?.busy ?? true)).toBe(false);
    await saveGame(page);
    const continuous = await savedRecord(page);

    const withoutPlaytime = (state: Record<string, unknown>) => {
      const { playtimeSeconds: _playtimeSeconds, ...stableState } = state;
      return stableState;
    };
    expect(withoutPlaytime(continuous.state)).toEqual(withoutPlaytime(singleAction.state));
  });

  test('最後一顆種子只播一次；單次 command 與長按的背包、日曆、任務及 RNG 終態相同', async ({ page }) => {
    const initial = await prepareFarmState(page, (state) => {
      state.plots = { '5,5': { watered: false, crop: null, dryDays: 0 } };
      state.tool = 'seedbag';
      state.selectedSeed = 'moon-bean';
      const inventory = state.inventory as { capacity: number; stacks: Array<{ itemId: string; quality: string; count: number }> };
      state.inventory = {
        ...inventory,
        stacks: [
          ...inventory.stacks.filter((stack) => !stack.itemId.startsWith('seed.')),
          { itemId: 'seed.moon-bean', quality: 'normal', count: 1 },
        ],
      };
    });
    await moveToEmptyField(page);
    await enableContinuousActions(page);
    await expect.poll(() => page.evaluate(() => {
      const candidate = window.__dewhollow?.interaction();
      return `${candidate?.labelKey}:${candidate?.plotKey}`;
    })).toBe('plant:5,5');
    await saveGame(page);
    const configured = await savedRecord(page);

    await page.locator('#hud-action').click();
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.effectLog().filter((entry) => entry.name === 'effect:plant').length ?? 0)).toBe(1);
    await expect.poll(async () => page.evaluate(() => window.__dewhollow?.actors().find((actor) => actor.id === 'player')?.busy ?? true)).toBe(false);
    await saveGame(page);
    const singleAction = await savedRecord(page);

    await restoreRecord(page, configured);
    await page.reload();
    await expect(page.locator('#game canvas')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
    await holdMainAction(page, 1000);
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.effectLog().filter((entry) => entry.name === 'effect:plant').length ?? 0)).toBe(1);
    await saveGame(page);
    const continuous = await savedRecord(page);

    const stable = (state: Record<string, unknown>) => {
      const { playtimeSeconds: _playtimeSeconds, ...rest } = state;
      return rest;
    };
    expect(stable(continuous.state)).toEqual(stable(singleAction.state));
    const inventory = continuous.state.inventory as { stacks: Array<{ itemId: string; count: number }> };
    expect(inventory.stacks.some((stack) => stack.itemId === 'seed.moon-bean')).toBe(false);
    expect(initial.state.rng).toBe(continuous.state.rng);
  });

  test('體力不足時長按不派發農務，也不消耗時間、資源或狀態', async ({ page }) => {
    await prepareFarmState(page, (state) => {
      state.plots = {};
      state.tool = 'hoe';
      state.energy = { current: 0, max: 100 };
    });
    await moveToEmptyField(page);
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.interaction().labelKey ?? '')).toBe('till');
    await enableContinuousActions(page);
    await saveGame(page);
    const before = await savedRecord(page);
    await holdMainAction(page, 900);
    await saveGame(page);
    const after = await savedRecord(page);

    const stable = (state: Record<string, unknown>) => {
      const { playtimeSeconds: _playtimeSeconds, ...rest } = state;
      return rest;
    };
    expect(stable(after.state)).toEqual(stable(before.state));
    expect(await page.evaluate(() => window.__dewhollow?.effectLog().filter((entry) => entry.name === 'effect:till').length ?? 0)).toBe(0);
  });
});
