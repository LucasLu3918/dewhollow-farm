import { fail, ok, type Result } from './result';

/** 加工機裡正在進行的一批加工：daysLeft 為 0 表示已完成、等玩家取回。 */
export interface ProcessingJob {
  recipeId: string;
  daysLeft: number;
}

/** 放入一批新的加工；機器的槽位滿了就不收。 */
export function startJob(
  jobs: readonly ProcessingJob[],
  recipeId: string,
  days: number,
  slots: number,
): Result<ProcessingJob[], 'MACHINE_FULL'> {
  if (jobs.length >= slots) return fail('MACHINE_FULL');
  return ok([...jobs, { recipeId, daysLeft: days }]);
}

/** 過了 days 天（睡覺時呼叫）：還沒完成的批次倒數，最少到 0。 */
export function passDays(jobs: readonly ProcessingJob[], days = 1): ProcessingJob[] {
  return jobs.map((job) => ({ ...job, daysLeft: Math.max(0, job.daysLeft - days) }));
}

/** 已完成的批次與還在加工的批次，各自保持放入的順序。 */
export function takeReady(jobs: readonly ProcessingJob[]): { ready: ProcessingJob[]; remaining: ProcessingJob[] } {
  const ready = jobs.filter((job) => job.daysLeft === 0);
  const remaining = jobs.filter((job) => job.daysLeft > 0);
  return { ready, remaining };
}
