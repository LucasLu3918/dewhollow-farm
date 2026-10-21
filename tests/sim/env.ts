/**
 * 模擬的執行環境：只在 Node（vitest）下有 process。專案的 TypeScript 沒有 Node 型別，所以在這裡自己宣告需要的部分。
 */
interface NodeLikeProcess {
  env: Record<string, string | undefined>;
  stdout: { write(text: string): void };
}

const nodeProcess = (globalThis as { process?: NodeLikeProcess }).process;

/** SIM_REPORT=1（`npm run sim`）時才跑完整的一年並印出報告。 */
export const REPORT = Boolean(nodeProcess?.env.SIM_REPORT);

export function print(text: string): void {
  nodeProcess?.stdout.write(text);
}
