import type { Point } from '../domain/content';
import { decorAt } from '../domain/decor';
import type { GameState } from '../domain/game-state';
import { countOf } from '../domain/inventory';
import { isRipe, plotKey } from '../domain/farm';
import { changeAt, effectiveKind } from '../domain/world-changes';
import { neighbor, tileAt } from '../domain/world';
import { residentAt } from './residents';
import type { ContentIndex } from './content-index';

/** Stable content key; the player-facing wording lives in content/controls.json. */
export type InteractionLabelKey =
  | 'talk' | 'pickUpDecor' | 'bulletin' | 'mailbox' | 'festival' | 'repair' | 'legacy'
  | 'mine' | 'castStar' | 'lightLantern' | 'fish' | 'feedAnimals' | 'kitchen' | 'workshop'
  | 'workbench' | 'petAnimal' | 'openCave' | 'sleep' | 'ship' | 'mineLocked' | 'shop'
  | 'forage' | 'chop' | 'cutGrass' | 'harvest' | 'till' | 'noSoil' | 'water' | 'fertilize'
  | 'alreadyPlanted' | 'alreadyTilled' | 'alreadyFertilized' | 'plant' | 'nothing';

export const INTERACTION_LABEL_KEYS: readonly InteractionLabelKey[] = [
  'talk', 'pickUpDecor', 'bulletin', 'mailbox', 'festival', 'repair', 'legacy', 'mine', 'castStar',
  'lightLantern', 'fish', 'feedAnimals', 'kitchen', 'workshop', 'workbench', 'petAnimal', 'openCave',
  'sleep', 'ship', 'mineLocked', 'shop', 'forage', 'chop', 'cutGrass', 'harvest', 'till', 'noSoil',
  'water', 'fertilize', 'alreadyPlanted', 'alreadyTilled', 'alreadyFertilized', 'plant', 'nothing',
];

export type InteractionAction =
  | 'talk' | 'pickUpDecor' | 'openBulletin' | 'collectMailbox' | 'openFestival' | 'openRepair' | 'openLegacy'
  | 'mineRock' | 'castStar' | 'lightLantern' | 'cast' | 'feedAnimals' | 'openKitchen' | 'openWorkshop'
  | 'openWorkbench' | 'petAnimal' | 'openCave' | 'sleep' | 'shipAll' | 'mineLocked' | 'openShop'
  | 'forage' | 'chopTree' | 'cutGrass' | 'workPlot' | 'nothing';

/** A read-only description of the exact target and semantic action an interact command will use. */
export interface InteractionDescriptor {
  action: InteractionAction;
  labelKey: InteractionLabelKey;
  target: Point | null;
  /** Optional stable id for actions that need a specific content entity. */
  entityId?: string;
  /** The current plot key when the action is a tool-dependent field action. */
  plotKey?: string;
}

const descriptor = (
  action: InteractionAction,
  labelKey: InteractionLabelKey,
  target: Point | null,
  extra: Pick<InteractionDescriptor, 'entityId' | 'plotKey'> = {},
): InteractionDescriptor => ({ action, labelKey, target, ...extra });

/** Pure and repeatable. It reads current state/content only; it never advances time or consumes RNG. */
export function resolveInteraction(state: GameState, index: ContentIndex): InteractionDescriptor {
  const target = neighbor(state.player, state.player.facing);
  const resident = residentAt(state, index, target.x, target.y);
  if (resident) return descriptor('talk', 'talk', target, { entityId: resident.npcId });

  const decor = decorAt(state.decor[state.mapId], target.x, target.y);
  if (decor) return descriptor('pickUpDecor', 'pickUpDecor', target, { entityId: decor.itemId });

  const tile = tileAt(index.map(state.mapId), target.x, target.y);
  if (!tile) return descriptor('nothing', 'nothing', null);
  const kind = effectiveKind(tile.kind, changeAt(state.worldChanges, state.mapId, target.x, target.y));

  if (tile.notice === 'bulletin') return descriptor('openBulletin', 'bulletin', target);
  if (tile.notice === 'mailbox') return descriptor('collectMailbox', 'mailbox', target);
  if (tile.notice === 'festival') return descriptor('openFestival', 'festival', target);
  if (tile.notice === 'repair') return descriptor('openRepair', 'repair', target);
  if (tile.notice === 'legacy') return descriptor('openLegacy', 'legacy', target);
  if (tile.kind === 'rock' || tile.kind === 'ore') {
    if (kind === tile.kind) return descriptor('mineRock', 'mine', target);
  }
  if (tile.festival === 'stars') return descriptor('castStar', 'castStar', target);
  if (tile.festival === 'lantern') return descriptor('lightLantern', 'lightLantern', target);
  if (tile.kind === 'water') return descriptor('cast', 'fish', target);
  if (tile.kind === 'trough') return descriptor('feedAnimals', 'feedAnimals', target);
  if (kind === 'kitchen') return descriptor('openKitchen', 'kitchen', target);
  if (kind === 'workshop') return descriptor('openWorkshop', 'workshop', target);
  if (kind === 'workbench') return descriptor('openWorkbench', 'workbench', target);
  if (tile.slot) return descriptor('petAnimal', 'petAnimal', target);
  if (tile.kind === 'cave' && kind === 'cave') return descriptor('openCave', 'openCave', target);
  if (kind === 'bed') return descriptor('sleep', 'sleep', target);
  if (kind === 'shipbox') return descriptor('shipAll', 'ship', target);
  if (kind === 'cave') return descriptor('mineLocked', 'mineLocked', target);
  if (kind === 'shop') return descriptor('openShop', 'shop', target, { entityId: tile.shop ?? '' });
  if (tile.kind === 'forage') return descriptor('forage', 'forage', target);
  if (kind === 'tree') return descriptor('chopTree', 'chop', target);
  if (kind === 'tuft') return descriptor('cutGrass', 'cutGrass', target);

  const key = plotKey(target.x, target.y);
  if (kind === 'field' || state.plots[key]) {
    const plot = state.plots[key];
    if (plot?.crop && isRipe(plot.crop, index.crop(plot.crop.cropId).growthDays)) {
      return descriptor('workPlot', 'harvest', target, { plotKey: key });
    }
    if (state.tool === 'hoe') {
      return descriptor('workPlot', plot ? 'alreadyTilled' : 'till', target, { plotKey: key });
    }
    if (!plot) return descriptor('workPlot', 'noSoil', target, { plotKey: key });
    if (state.tool === 'can') return descriptor('workPlot', 'water', target, { plotKey: key });
    if (plot.crop && state.tool === 'seedbag') {
      const hasFertilizer = countOf(state.inventory, 'fertilizer-fine') + countOf(state.inventory, 'fertilizer-basic') > 0;
      if (!hasFertilizer) return descriptor('workPlot', 'alreadyPlanted', target, { plotKey: key });
      return descriptor('workPlot', plot.fertilizer ? 'alreadyFertilized' : 'fertilize', target, { plotKey: key });
    }
    return descriptor('workPlot', 'plant', target, { plotKey: key });
  }
  return descriptor('nothing', 'nothing', null);
}
