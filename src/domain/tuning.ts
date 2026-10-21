/** 可調整的數值（體力、耗時、睡眠時間）。由 content/tuning.json 提供，不寫死在規則中。 */

export type ActionKind = 'till' | 'water' | 'plant' | 'harvest' | 'ship';

export const ACTION_KINDS: readonly ActionKind[] = ['till', 'water', 'plant', 'harvest', 'ship'];

export interface Tuning {
  energy: {
    max: number;
    /** 每個動作消耗的體力。 */
    costs: Record<ActionKind, number>;
  };
  harvest: {
    /** 每次收穫隨機產出的數量範圍（含兩端）。 */
    min: number;
    max: number;
  };
  time: {
    /** 睡醒時間，以一天中的分鐘數表示（例如 360 代表 06:00）。 */
    wakeMinute: number;
    /** 每個有效動作花費的分鐘數。 */
    minutesPerAction: number;
  };
}
