import { expect, test, type Page } from '@playwright/test';

/**
 * 無障礙（M7）：設定面板的改按鍵（衝突詢問與交換、Esc 取消、Esc 不能指派）、恢復預設、字級三檔、
 * 色盲標記、閃光與震動開關，以及偏好在重新整理後保留（偏好存在 localStorage，不進存檔）。
 * 注意：按鍵前要等場景建立好（window.__dewhollow 出現）；換字級等設定會立刻套用，不需要重新整理。
 */

const SETTINGS_KEY = 'dewhollow-farm.settings';

async function startGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).not.toBe('');
}

async function openSettings(page: Page): Promise<void> {
  await page.keyboard.press('o');
  await expect(page.locator('#settings-panel')).toBeVisible();
}

/** 改鍵列：依動作的名稱找到那一列（每一列的名稱與按鍵是兩個欄位）。 */
function keyRow(page: Page, label: string) {
  return page.locator('#settings-keys li', { hasText: label });
}

async function storedSettings(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
  }, SETTINGS_KEY);
}

function settingsPayload(record: Record<string, unknown> | null): Record<string, unknown> | null {
  return record?.settings && typeof record.settings === 'object' ? (record.settings as Record<string, unknown>) : null;
}

test.describe('按鍵重新綁定', () => {
  test('按 O 打開設定，列出每個動作目前的按鍵', async ({ page }) => {
    await startGame(page);
    await openSettings(page);
    await expect(keyRow(page, '互動').locator('kbd')).toHaveText('X');
    await expect(keyRow(page, '上移').locator('kbd')).toHaveText('↑');
  });

  test('改鍵時按 Esc 取消，按鍵維持原樣，面板不關', async ({ page }) => {
    await startGame(page);
    await openSettings(page);
    await page.locator('#settings-keys button[data-action="interact"]').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#settings-message')).toHaveText('已取消改鍵。');
    await expect(page.locator('#settings-panel')).toBeVisible();
    await expect(keyRow(page, '互動').locator('kbd')).toHaveText('X');
  });

  test('同一按鍵已被別的動作使用時詢問，確認交換後兩者互換按鍵', async ({ page }) => {
    await startGame(page);
    await openSettings(page);
    await page.locator('#settings-keys button[data-action="interact"]').click();
    // Z 是「切換工具」的預設按鍵，所以這裡會出現交換的詢問。
    await page.keyboard.press('z');
    await expect(page.locator('#settings-prompt')).toBeVisible();
    await page.locator('#settings-swap').click();
    await expect(keyRow(page, '互動').locator('kbd')).toHaveText('Z');
    await expect(keyRow(page, '切換工具').locator('kbd')).toHaveText('X');
    const saved = await storedSettings(page);
    expect(saved?.schemaVersion).toBe(2);
    expect((settingsPayload(saved)?.bindings as Record<string, unknown>).interact).toBe('z');
  });

  test('衝突時取消交換，兩者都維持原來的按鍵', async ({ page }) => {
    await startGame(page);
    await openSettings(page);
    await page.locator('#settings-keys button[data-action="interact"]').click();
    await page.keyboard.press('z');
    await page.locator('#settings-cancel-swap').click();
    await expect(page.locator('#settings-prompt')).toBeHidden();
    await expect(keyRow(page, '互動').locator('kbd')).toHaveText('X');
    await expect(keyRow(page, '切換工具').locator('kbd')).toHaveText('Z');
  });

  test('恢復預設按鍵會把改過的按鍵還原', async ({ page }) => {
    await startGame(page);
    await openSettings(page);
    await page.locator('#settings-keys button[data-action="interact"]').click();
    await page.keyboard.press('n');
    await expect(keyRow(page, '互動').locator('kbd')).toHaveText('N');
    await page.locator('#settings-reset').click();
    await expect(keyRow(page, '互動').locator('kbd')).toHaveText('X');
  });

  test('改好的按鍵在重新整理後仍然保留', async ({ page }) => {
    await startGame(page);
    await openSettings(page);
    await page.locator('#settings-keys button[data-action="interact"]').click();
    await page.keyboard.press('n');
    await expect(keyRow(page, '互動').locator('kbd')).toHaveText('N');
    await page.reload();
    await expect(page.locator('#game canvas')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).not.toBe('');
    await openSettings(page);
    await expect(keyRow(page, '互動').locator('kbd')).toHaveText('N');
  });

  test('Esc 關閉設定面板', async ({ page }) => {
    await startGame(page);
    await openSettings(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#settings-panel')).toBeHidden();
  });
});

test.describe('字級、色盲模式與閃光震動', () => {
  test('字級三檔即時生效，並記在偏好裡', async ({ page }) => {
    await startGame(page);
    await openSettings(page);
    await page.locator('#settings-font button', { hasText: /^大$/ }).click();
    await expect(page.locator('#settings-font button', { hasText: /^大$/ })).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--font-scale')))
      .toBe('1.25');
    await page.locator('#settings-font button', { hasText: '特大' }).click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--font-scale')))
      .toBe('1.5');
    const saved = await storedSettings(page);
    expect(settingsPayload(saved)?.fontSize).toBe('xlarge');
  });

  test('色盲模式打開後，訊息前面加上 ✓ 或 ✕ 的文字標記', async ({ page }) => {
    await startGame(page);
    await openSettings(page);
    await page.locator('#settings-colorblind').check();
    await expect(page.locator('html')).toHaveAttribute('data-colorblind', 'on');
    await page.keyboard.press('Escape');
    // 按 M 會留下一則結果訊息（已靜音／已開啟音效）。
    await page.keyboard.press('m');
    await expect(page.locator('#hud-log li').last()).toHaveText(/^✓ /);
    await page.keyboard.press('m');
  });

  test('閃光與震動的三個開關預設全部開啟，可以個別關閉', async ({ page }) => {
    await startGame(page);
    await openSettings(page);
    await expect(page.locator('#settings-shake')).toBeChecked();
    await expect(page.locator('#settings-flash')).toBeChecked();
    await expect(page.locator('#settings-particles')).toBeChecked();
    await page.locator('#settings-shake').uncheck();
    const saved = await storedSettings(page);
    expect((settingsPayload(saved)?.effects as { shake: boolean }).shake).toBe(false);
    expect((settingsPayload(saved)?.effects as { particles: boolean }).particles).toBe(true);
  });

  test('v1 preferences survive migration when a new preference is saved', async ({ page }) => {
    await page.addInitScript(
      ({ key }) => {
        window.localStorage.setItem(key, JSON.stringify({
          schemaVersion: 1,
          fontSize: 'large',
          colorblind: true,
          effects: { shake: false, flash: true, particles: false },
          touchControls: 'off',
        }));
      },
      { key: SETTINGS_KEY },
    );
    await startGame(page);
    await openSettings(page);
    await page.locator('#settings-font button', { hasText: /^特大$/ }).click();

    const record = await storedSettings(page);
    expect(record?.schemaVersion).toBe(2);
    expect(settingsPayload(record)).toMatchObject({
      fontSize: 'xlarge',
      colorblind: true,
      effects: { shake: false, flash: true, particles: false },
      touchControls: 'off',
    });
  });

  test('a future settings version remains untouched and reports that changes are not saved', async ({ page }) => {
    const future = JSON.stringify({ schemaVersion: 99, settings: { fontSize: 'xlarge', futureField: true } });
    await page.addInitScript(
      ({ key, value }) => window.localStorage.setItem(key, value),
      { key: SETTINGS_KEY, value: future },
    );
    await startGame(page);
    await openSettings(page);
    await page.locator('#settings-font button', { hasText: /^大$/ }).click();

    await expect(page.locator('#settings-message')).toContainText('無法儲存設定');
    expect(await page.evaluate((key) => window.localStorage.getItem(key), SETTINGS_KEY)).toBe(future);
  });

  test('系統開啟「減少動態」時，說明會寫出效果已全部關閉', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await startGame(page);
    await openSettings(page);
    await expect(page.locator('#settings-reduced')).toContainText('已開啟');
  });
});
