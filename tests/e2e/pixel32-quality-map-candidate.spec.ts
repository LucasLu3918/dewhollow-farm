import { expect, test, type Page } from '@playwright/test';

const candidateQuery = '?renderProfile=pixel32&gate1Runtime=pixel32-map-animation&qualityMapScene=high-detail-candidate';

async function waitForStep(page: Page, x: number, y: number): Promise<void> {
  try {
    await page.waitForFunction(({ targetX, targetY }) => {
      const movement = window.__dewhollow?.movement();
      return movement?.tile.x === targetX && movement.tile.y === targetY
        && !movement.moving && !movement.pending && movement.heldDirection === null;
    }, { targetX: x, targetY: y }, { timeout: 5_000 });
  } catch {
    const current = await page.evaluate(() => window.__dewhollow?.movement() ?? null);
    throw new Error(`Expected movement to (${x},${y}); current state: ${JSON.stringify(current)}`);
  }
}

async function walk(page: Page, key: string, count: number, x: number, y: number): Promise<void> {
  for (let step = 0; step < count; step += 1) {
    await page.keyboard.press(key);
    const next = key === 'ArrowUp' ? { x, y: y - 1 }
      : key === 'ArrowDown' ? { x, y: y + 1 }
        : key === 'ArrowLeft' ? { x: x - 1, y }
          : { x: x + 1, y };
    await waitForStep(page, next.x, next.y);
    x = next.x;
    y = next.y;
  }
}

test('Pixel32 high-detail map candidates preserve movement blocking and portal interaction', async ({ page }) => {
  await page.goto(candidateQuery);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');

  const start = await page.evaluate(() => ({
    tile: window.__dewhollow?.movement().tile,
    sceneLoaded: window.__dewhollow?.sprites().some((sprite) => sprite.key === 'pixel32-quality-scene-farm') ?? false,
    startupErrors: [...document.querySelectorAll('#hud-log li.error')]
      .map((entry) => entry.textContent ?? '')
      .filter((message) => !message.includes('Pixel32 候選預覽使用隔離的暫存存檔')),
    memorySaveNotice: [...document.querySelectorAll('#hud-log li.error')]
      .some((entry) => entry.textContent?.includes('Pixel32 候選預覽使用隔離的暫存存檔')),
  }));
  expect(start.tile).toMatchObject({ x: 7, y: 9 });
  expect(start.memorySaveNotice).toBe(true);
  await waitForStep(page, 7, 9);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.sprites()
    .some((sprite) => sprite.key === 'pixel32-quality-scene-farm') ?? false)).toBe(true);
  expect(start.startupErrors).toEqual([]);

  // Follow the candidate's center lane and south opening into its fenced crop beds.
  await walk(page, 'ArrowDown', 5, 7, 9);
  await walk(page, 'ArrowRight', 13, 7, 14);
  await walk(page, 'ArrowDown', 12, 20, 14);
  await walk(page, 'ArrowLeft', 1, 20, 26);
  await walk(page, 'ArrowDown', 1, 19, 26);
  await walk(page, 'ArrowLeft', 10, 19, 27);
  await walk(page, 'ArrowUp', 1, 9, 27);
  await page.keyboard.press('ArrowRight');
  await waitForStep(page, 10, 26);
  const tillState = await page.evaluate(() => ({
    mapId: window.__dewhollow?.mapId(),
    movement: window.__dewhollow?.movement(),
    tool: window.__dewhollow?.gameState().tool,
    interaction: window.__dewhollow?.interaction(),
  }));
  if (tillState.mapId !== 'farm' || tillState.interaction?.action !== 'workPlot'
    || tillState.interaction.labelKey !== 'till'
    || tillState.interaction.target?.x !== 11 || tillState.interaction.target?.y !== 26) {
    throw new Error(`Unexpected farm till target: ${JSON.stringify(tillState)}`);
  }
  await page.screenshot({ path: 'test-results/pixel32-quality-farm-before-till.png' });
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('開墾了一塊田');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.gameState().plots['11,26']?.watered)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.qualityPlots()
    .some((plot) => plot.x === 11 && plot.y === 26 && plot.visible) ?? false)).toBe(true);
  await page.screenshot({ path: 'test-results/pixel32-quality-farm-after-till.png' });
  await walk(page, 'ArrowDown', 1, 10, 26);
  await walk(page, 'ArrowRight', 9, 10, 27);
  await walk(page, 'ArrowUp', 1, 19, 27);
  await walk(page, 'ArrowRight', 1, 19, 26);
  await walk(page, 'ArrowUp', 17, 20, 26);

  // The existing clear route reaches the farmhouse door without crossing candidate obstacles.
  for (let x = 21; x <= 26; x += 1) {
    await page.keyboard.press('ArrowRight');
    await waitForStep(page, x, 9);
  }
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('house');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.sprites()
    .some((sprite) => sprite.key === 'pixel32-quality-scene-house') ?? false)).toBe(true);
  await waitForStep(page, 10, 18);

  // Reach the north wall through the clear center aisle and confirm it remains solid.
  await walk(page, 'ArrowUp', 17, 10, 18);
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => window.__dewhollow?.movement().blockedDirection === 'up', undefined, { timeout: 5_000 });
  expect(await page.evaluate(() => window.__dewhollow?.movement().tile)).toMatchObject({ x: 10, y: 1 });
  await page.keyboard.up('ArrowUp');
});

test('Pixel32 forest trunk blocks and chops; the redesigned lake dock is walkable and fishable', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(candidateQuery);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');

  // Use the candidate's south lane and east portal to enter the forest.
  await walk(page, 'ArrowDown', 5, 7, 9);
  await walk(page, 'ArrowRight', 31, 7, 14);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('forest');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.sprites()
    .some((sprite) => sprite.key === 'pixel32-quality-scene-forest') ?? false)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.qualityDynamicObjects()
    .some((object) => object.x === 8 && object.y === 13 && object.kind === 'tree' && object.visible) ?? false)).toBe(true);

  // The visible bottom-center trunk is solid, but remains a normal axe target from its south approach.
  await walk(page, 'ArrowRight', 6, 2, 7);
  await walk(page, 'ArrowDown', 5, 8, 7);
  await page.keyboard.down('ArrowDown');
  await page.waitForFunction(() => window.__dewhollow?.movement().blockedDirection === 'down', undefined, { timeout: 5_000 });
  expect(await page.evaluate(() => window.__dewhollow?.movement().tile)).toMatchObject({ x: 8, y: 12 });
  await page.keyboard.up('ArrowDown');
  await page.screenshot({ path: 'test-results/pixel32-quality-forest-before.png' });
  await page.keyboard.press('a');
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('砍下了');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.gameState().worldChanges['forest,8,13'])).toBe('chopped');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.qualityDynamicObjects()
    .some((object) => object.x === 8 && object.y === 13 && object.kind === 'tree' && object.visible) ?? true)).toBe(false);
  await page.screenshot({ path: 'test-results/pixel32-quality-forest-after-chop.png' });

  // Forage uses the same independent layer: picking it hides only that object over the clean base.
  await walk(page, 'ArrowUp', 1, 8, 12);
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('採到了');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.gameState().worldChanges['forest,8,10'])).toBe('picked');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.qualityDynamicObjects()
    .some((object) => object.x === 8 && object.y === 10 && object.kind === 'forage' && object.visible) ?? true)).toBe(false);

  // Reach the forest lake portal by the connected center path.
  await walk(page, 'ArrowUp', 2, 8, 11);
  await walk(page, 'ArrowRight', 4, 8, 9);
  await walk(page, 'ArrowUp', 7, 12, 9);
  await walk(page, 'ArrowRight', 10, 12, 2);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('lake');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.sprites()
    .some((sprite) => sprite.key === 'pixel32-quality-scene-lake') ?? false)).toBe(true);

  // The lower shore and dock are traversable, and water next to the dock still resolves fishing.
  await walk(page, 'ArrowRight', 5, 1, 7);
  await walk(page, 'ArrowDown', 5, 6, 7);
  await walk(page, 'ArrowRight', 10, 6, 12);
  await walk(page, 'ArrowUp', 4, 16, 12);
  await walk(page, 'ArrowRight', 1, 16, 8);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__dewhollow?.movement().blockedDirection === 'right', undefined, { timeout: 5_000 });
  expect(await page.evaluate(() => window.__dewhollow?.movement().tile)).toMatchObject({ x: 17, y: 8 });
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('r');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.interaction().action ?? '')).toBe('cast');
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText(/魚沒有上鉤|魚上鉤了|魚跑掉了|釣到了/);
});

test('Pixel32 village facade blocks movement while the reachable storefront opens normally', async ({ page }) => {
  await page.goto(candidateQuery);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');

  // Reach the southern village portal through the open central farm lane.
  await walk(page, 'ArrowDown', 5, 7, 9);
  await walk(page, 'ArrowRight', 13, 7, 14);
  await walk(page, 'ArrowDown', 12, 20, 14);
  await walk(page, 'ArrowLeft', 1, 20, 26);
  await walk(page, 'ArrowDown', 2, 19, 26);
  await walk(page, 'ArrowRight', 1, 19, 28);
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('village');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.sprites()
    .some((sprite) => sprite.key === 'pixel32-quality-scene-village') ?? false)).toBe(true);

  await walk(page, 'ArrowUp', 6, 7, 10);
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => window.__dewhollow?.movement().blockedDirection === 'up', undefined, { timeout: 5_000 });
  expect(await page.evaluate(() => window.__dewhollow?.movement().tile)).toMatchObject({ x: 7, y: 4 });
  await page.keyboard.up('ArrowUp');

  // The shop counter remains approachable from the open southern path.
  await walk(page, 'ArrowDown', 1, 7, 4);
  await walk(page, 'ArrowLeft', 4, 7, 5);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('x');
  await expect(page.locator('#shop-panel')).toBeVisible();
  await expect(page.locator('#shop-title')).toHaveText('雜貨店');
});

test('Pixel32 pasture tuft layer hides only the cut tuft while the gate route remains playable', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(candidateQuery);
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');

  // The pasture gate opens on spring day 15; advance through normal bed interactions in the isolated save.
  await walk(page, 'ArrowRight', 19, 7, 9);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('house');
  await walk(page, 'ArrowUp', 13, 10, 18);
  await walk(page, 'ArrowRight', 7, 10, 5);
  await page.keyboard.press('ArrowUp');
  for (let day = 2; day <= 15; day += 1) {
    await page.keyboard.press('x');
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.gameState().calendar.day)).toBe(day);
  }

  // Return to farm, then open the candidate's west pasture gate at its unlocked date.
  await walk(page, 'ArrowDown', 13, 17, 5);
  await walk(page, 'ArrowLeft', 7, 17, 18);
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  const position = await page.evaluate(() => window.__dewhollow?.movement().tile);
  if (!position) throw new Error('player position unavailable');
  await walk(page, 'ArrowDown', 14 - position.y, position.x, position.y);
  await walk(page, 'ArrowLeft', position.x - 1, position.x, 14);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('pasture');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.sprites()
    .some((sprite) => sprite.key === 'pixel32-quality-scene-pasture') ?? false)).toBe(true);

  // The open lane reaches a live tuft above it; the existing sickle action updates its sprite.
  await walk(page, 'ArrowRight', 11, 1, 7);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.qualityDynamicObjects()
    .some((object) => object.x === 12 && object.y === 8 && object.kind === 'tuft' && object.visible) ?? false)).toBe(true);
  await page.keyboard.down('ArrowDown');
  await page.waitForFunction(() => window.__dewhollow?.movement().blockedDirection === 'down', undefined, { timeout: 5_000 });
  await page.keyboard.up('ArrowDown');
  await page.keyboard.press('g');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.gameState().tool ?? '')).toBe('sickle');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.interaction())).toMatchObject({
    action: 'cutGrass',
    target: { x: 12, y: 8 },
  });
  await page.screenshot({ path: 'test-results/pixel32-quality-pasture-before-cut.png' });
  await page.keyboard.press('x');
  await expect(page.locator('#hud-log')).toContainText('割下');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.gameState().worldChanges['pasture,12,8'])).toBe('cut');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.qualityDynamicObjects()
    .some((object) => object.x === 12 && object.y === 8 && object.kind === 'tuft' && object.visible) ?? true)).toBe(false);
  await page.screenshot({ path: 'test-results/pixel32-quality-pasture-after-cut.png' });
});
