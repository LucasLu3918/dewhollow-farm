import { CHECKPOINT_STEP, mineLayerOf } from '../domain/mine';

/**
 * HUD 的礦坑狀態：在礦坑裡就顯示目前第幾層，並顯示電梯（從入口進去）可以直接到的檢查點層。
 * 純文字，不含規則：檢查點的判斷由 domain/mine.ts 與 game-commands 負責。
 */
export function mineStatusLabel(state: { mapId: string; mineCheckpoint: number }): string {
  const elevator = state.mineCheckpoint > 1 ? `電梯可到第 ${state.mineCheckpoint} 層` : `電梯尚未開通（走到第 ${CHECKPOINT_STEP} 層會設下檢查點）`;
  const layer = mineLayerOf(state.mapId);
  return layer === null ? `礦坑：${elevator}` : `礦坑第 ${layer} 層｜${elevator}`;
}
