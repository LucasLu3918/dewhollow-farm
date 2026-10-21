/**
 * 煙火的火花位置（純函式，不依賴 Phaser，方便單元測試）。
 */

export interface SparkOffset {
  dx: number;
  dy: number;
}

/** 一朵煙火的火花位置：等角散開，半徑 radius，整體旋轉 rotation（弧度）。 */
export function burstPoints(count: number, radius: number, rotation: number): SparkOffset[] {
  const points: SparkOffset[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = rotation + (i * Math.PI * 2) / count;
    points.push({ dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius });
  }
  return points;
}
