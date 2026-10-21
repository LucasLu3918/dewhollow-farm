import { SAVE_SCHEMA_VERSION } from '../../domain/game-state';
import { cropItemId, DEFAULT_MAX_STACK, seedItemId, type ItemStack } from '../../domain/items';
import { describeIssue, SaveFormatError } from './save-errors';
import { gameStateV1Schema, type GameStateV1 } from './save-schema-v1';

/** 遷移時需要的、存檔本身不包含的設定。 */
export interface MigrationContext {
  /** 背包格數（來自 content/tuning.json）。 */
  inventoryCapacity: number;
}

type Migration = (state: unknown, context: MigrationContext) => unknown;

/**
 * 遷移表：鍵為「來源版本」，每個函式把該版本升到下一版。
 * 新增存檔版本時：凍結舊 schema、加一個遷移與它的測試、再把 SAVE_SCHEMA_VERSION 加一。
 */
const MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: migrateV1ToV2,
};

/**
 * 把任何受支援版本的存檔內容升到目前版本。
 * 版本太新、版本缺失或舊格式損毀時拋出 SaveFormatError，不會猜測或補值。
 */
export function migrateState(raw: unknown, context: MigrationContext): unknown {
  let version = versionOf(raw);
  if (version > SAVE_SCHEMA_VERSION) {
    throw new SaveFormatError(`這份存檔來自更新版本的遊戲（v${version}），請更新遊戲後再讀取`);
  }
  let state = raw;
  while (version < SAVE_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) throw new SaveFormatError(`沒有從存檔版本 v${version} 升級的方法`);
    state = migrate(state, context);
    version += 1;
  }
  return state;
}

function versionOf(raw: unknown): number {
  if (typeof raw !== 'object' || raw === null || !('schemaVersion' in raw)) {
    throw new SaveFormatError('存檔缺少存檔版本（schemaVersion）');
  }
  const version = raw.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new SaveFormatError(`存檔版本無效：${String(version)}`);
  }
  return version;
}

/** v1 → v2：背包改為通用物品堆疊、出貨箱改為物品條目、新增遊玩時數。 */
function migrateV1ToV2(raw: unknown, context: MigrationContext): unknown {
  const parsed = gameStateV1Schema.safeParse(raw);
  if (!parsed.success) {
    throw new SaveFormatError(`存檔 v1 格式錯誤於 ${describeIssue(parsed.error.issues[0])}`);
  }
  const { bag, shipBox, ...rest }: GameStateV1 = parsed.data;

  const stacks: ItemStack[] = [
    ...stacksOf(bag.seeds, seedItemId),
    ...stacksOf(bag.crops, cropItemId),
  ];
  return {
    ...rest,
    schemaVersion: 2,
    // 舊存檔放得下的東西，遷移後一定要放得下，所以容量不足時加大，而不是丟掉物品。
    inventory: { capacity: Math.max(context.inventoryCapacity, stacks.length), stacks },
    shipBox: { entries: entriesOf(shipBox.items, cropItemId) },
    playtimeSeconds: 0,
  };
}

function stacksOf(counts: Record<string, number>, toItemId: (cropId: string) => string): ItemStack[] {
  const stacks: ItemStack[] = [];
  for (const [cropId, total] of Object.entries(counts)) {
    for (let left = total; left > 0; left -= DEFAULT_MAX_STACK) {
      stacks.push({ itemId: toItemId(cropId), quality: 'normal', count: Math.min(left, DEFAULT_MAX_STACK) });
    }
  }
  return stacks;
}

function entriesOf(counts: Record<string, number>, toItemId: (cropId: string) => string): ItemStack[] {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([cropId, count]) => ({ itemId: toItemId(cropId), quality: 'normal' as const, count }));
}
