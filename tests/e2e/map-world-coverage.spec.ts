// @ts-expect-error Node APIs are available to Playwright; this app's tsconfig omits @types/node.
import * as nodeFs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { MapDef, Point } from '../../src/domain/content';
import type { TileDef } from '../../src/domain/content';

const fileSystem = nodeFs as unknown as {
  readdirSync(path: string): string[];
  readFileSync(path: string, encoding: 'utf8'): string;
};
const workingDirectory = (globalThis as typeof globalThis & { process: { cwd(): string } }).process.cwd();
const currentSaveFixture = JSON.parse(fileSystem.readFileSync(
  `${workingDirectory}/tests/fixtures/saves/v24-house-layout.json`,
  'utf8',
)) as { slot: string; state: Record<string, unknown> };
const mapFiles: Array<{ file: string; map: MapDef }> = fileSystem.readdirSync(`${workingDirectory}/content/maps`)
  .filter((file) => file.endsWith('.json'))
  .map((file) => ({
    file: `content/maps/${file}`,
    map: JSON.parse(fileSystem.readFileSync(`${workingDirectory}/content/maps/${file}`, 'utf8')) as MapDef,
  }))
  .sort((left, right) => left.file.localeCompare(right.file));

const screenshotDirectory = 'docs/art/reports/p6-064-map-coverage/screenshots';
const directions = [
  { key: 'ArrowUp', name: 'up', x: 0, y: -1 },
  { key: 'ArrowRight', name: 'right', x: 1, y: 0 },
  { key: 'ArrowDown', name: 'down', x: 0, y: 1 },
  { key: 'ArrowLeft', name: 'left', x: -1, y: 0 },
] as const;
const walkableKinds = new Set(['grass', 'field', 'path', 'door', 'floor', 'forage', 'stairs']);

interface PlayerDebug {
  tileX: number;
  tileY: number;
  busy: boolean;
}

interface DoorCell {
  mapId: string;
  symbol: string;
  x: number;
  y: number;
  destination: string | null;
  landing: Point | null;
  requirement?: { type: 'date'; season: string; day: number } | { type: 'flag'; flag: string };
}

async function writeSave(page: Page, fixture: {
  mapId: string;
  player: Point & { facing: string };
  season?: string;
  day?: number;
  flags?: Record<string, boolean>;
}): Promise<void> {
  const mapFlags = fixture.mapId === 'house-full'
    ? { 'house-wing': true, 'house-full': true }
    : fixture.mapId === 'house-wing' ? { 'house-wing': true } : {};
  const record = {
    slot: currentSaveFixture.slot,
    savedAt: '2026-10-28T00:00:00.000Z',
    state: {
      ...currentSaveFixture.state,
      schemaVersion: 25,
      calendar: {
        ...(currentSaveFixture.state.calendar as Record<string, unknown>),
        season: fixture.season ?? 'spring',
        day: fixture.day ?? 4,
        minuteOfDay: 600,
      },
      mapId: fixture.mapId,
      player: fixture.player,
      flags: { ...mapFlags, ...fixture.flags },
      hotbar: [null, null, null, null],
    },
  };
  await page.evaluate((nextRecord) => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('dewhollow-farm');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('saves', 'readwrite');
      transaction.objectStore('saves').put(nextRecord);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
  }), record);
}

async function openMap(page: Page, mapId: string, player: Point & { facing: string }, options: {
  season?: string;
  day?: number;
  flags?: Record<string, boolean>;
} = {}): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await writeSave(page, { mapId, player, ...options });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe(mapId);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.actors().some((actor) => actor.id === 'player') ?? false)).toBe(true);
}

async function player(page: Page): Promise<PlayerDebug> {
  const actor = await page.evaluate(() => window.__dewhollow?.actors().find((entry) => entry.id === 'player') ?? null);
  if (!actor) throw new Error('找不到玩家');
  return actor as PlayerDebug;
}

function tileAt(map: MapDef, point: Point): MapDef['legend'][string] | null {
  if (point.x < 0 || point.y < 0 || point.x >= map.width || point.y >= map.height) return null;
  const symbol = map.rows[point.y]?.[point.x];
  return symbol ? map.legend[symbol] ?? null : null;
}

function collisionRoute(map: MapDef): { steps: Array<{ key: string; point: Point }>; blockedKey: string } {
  const queue: Array<{ point: Point; steps: Array<{ key: string; point: Point }> }> = [{ point: map.spawn, steps: [] }];
  const visited = new Set([`${map.spawn.x},${map.spawn.y}`]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const direction of directions) {
      const next = { x: current.point.x + direction.x, y: current.point.y + direction.y };
      const tile = tileAt(map, next);
      if (!tile || !walkableKinds.has(tile.kind)) return { steps: current.steps, blockedKey: direction.key };
      if (tile.kind === 'door') continue;
      const key = `${next.x},${next.y}`;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ point: next, steps: [...current.steps, { key: direction.key, point: next }] });
    }
  }
  throw new Error(`地圖 ${map.id} 的出生點連通區沒有可用的阻擋格`);
}

function portalCells(map: MapDef): DoorCell[] {
  const found: DoorCell[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const symbol = map.rows[y]?.[x];
      const tile: TileDef | undefined = symbol ? map.legend[symbol] : undefined;
      if (!symbol || tile?.kind !== 'door') continue;
      const target = mapFiles.find((entry) => entry.map.id === tile.to)?.map;
      const landing = target ? (tile.spawn ?? target.spawn) : null;
      found.push({
        mapId: map.id,
        symbol,
        x,
        y,
        destination: tile.to ?? null,
        landing: landing ? { ...landing } : null,
        requirement: tile.requires as DoorCell['requirement'],
      });
    }
  }
  return found;
}

function portalStand(portal: DoorCell, map: MapDef): { player: Point & { facing: string }; key: string } {
  const direction = directions.find(({ x, y }) => {
    const stand = { x: portal.x - x, y: portal.y - y };
    const tile = tileAt(map, stand);
    return tile && walkableKinds.has(tile.kind) && tile.kind !== 'door';
  });
  if (!direction) throw new Error(`portal ${map.id} (${portal.x},${portal.y}) 沒有相鄰可站立格`);
  return {
    player: { x: portal.x - direction.x, y: portal.y - direction.y, facing: direction.name },
    key: direction.key,
  };
}

async function verifyTransition(page: Page, portal: DoorCell, source: MapDef): Promise<void> {
  const stand = portalStand(portal, source);
  const flags = portal.requirement?.type === 'flag' ? { [portal.requirement.flag]: true } : {};
  const season = portal.requirement?.type === 'date' ? portal.requirement.season : 'spring';
  const day = portal.requirement?.type === 'date' ? portal.requirement.day : 4;
  await openMap(page, source.id, stand.player, { season, day, flags });
  await page.keyboard.press(stand.key);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe(portal.destination);
  await expect.poll(async () => {
    const current = await player(page);
    return { x: current.tileX, y: current.tileY, busy: current.busy };
  }).toEqual({ x: portal.landing!.x, y: portal.landing!.y, busy: false });
}

test('P6-064 runtime coverage discovers every authored map file', () => {
  expect(mapFiles).toHaveLength(12);
  expect(mapFiles.every(({ file, map }) => file === `content/maps/${map.id}.json`)).toBe(true);
  expect(mapFiles.flatMap(({ map }) => portalCells(map))).toHaveLength(22);
});

for (const { file, map } of mapFiles) {
  test(`renders ${map.id} at its authored spawn, rejects a blocked step, and captures coverage evidence`, async ({ page }) => {
    await openMap(page, map.id, { ...map.spawn, facing: 'down' });
    const actor = await player(page);
    expect({ x: actor.tileX, y: actor.tileY }).toEqual(map.spawn);
    const spriteCount = await page.evaluate(() => window.__dewhollow?.sprites().length ?? 0);
    expect(spriteCount, `${file} should render its map layers`).toBeGreaterThan(0);
    await page.locator('#game canvas').screenshot({ path: `${screenshotDirectory}/${map.id}.png`, animations: 'disabled' });

    const collision = collisionRoute(map);
    for (const step of collision.steps) {
      await page.keyboard.press(step.key);
      await expect.poll(async () => {
        const current = await player(page);
        return { x: current.tileX, y: current.tileY, busy: current.busy };
      }).toEqual({ ...step.point, busy: false });
    }
    const blockedAt = await player(page);
    const beforeMap = await page.evaluate(() => window.__dewhollow?.mapId() ?? '');
    await page.keyboard.press(collision.blockedKey);
    await expect.poll(async () => {
      const current = await player(page);
      return { mapId: await page.evaluate(() => window.__dewhollow?.mapId() ?? ''), x: current.tileX, y: current.tileY, busy: current.busy };
    }).toEqual({ mapId: beforeMap, x: blockedAt.tileX, y: blockedAt.tileY, busy: false });
  });
}

const allPortals = mapFiles.flatMap(({ map }) => portalCells(map).map((portal) => ({ source: map, portal })));
for (const { source, portal } of allPortals) {
  test(`transitions ${source.id} portal ${portal.symbol} (${portal.x},${portal.y}) to ${portal.destination}`, async ({ page }) => {
    await verifyTransition(page, portal, source);
  });
}
