const DEFAULT_STEP_DURATION_MS = 150;
const SLOW_CANDIDATE_STEP_DURATION_MS = 240;

/** Resolve the allowlisted movement timing for the Pixel32 development candidate only. */
export function candidateMovementStepDurationMs(
  development: boolean,
  candidateRuntime: boolean,
  searchParams: URLSearchParams,
): number {
  const profiles = searchParams.getAll('gate1MovementSpeed');
  return development && candidateRuntime && profiles.length === 1 && profiles[0] === 'slow'
    ? SLOW_CANDIDATE_STEP_DURATION_MS
    : DEFAULT_STEP_DURATION_MS;
}
