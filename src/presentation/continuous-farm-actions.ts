export type FarmActionKind = 'till' | 'water' | 'plant';

export interface FarmActionTarget {
  key: string;
  action: FarmActionKind;
}

/** Only the three explicitly supported field labels may enter the repeat coordinator. */
export function farmActionTarget(label: string, plotKey: string | undefined): FarmActionTarget | null {
  if (!plotKey) return null;
  if (label === 'till' || label === 'water' || label === 'plant') return { key: plotKey, action: label };
  return null;
}

export interface FarmActionOutcome extends FarmActionTarget {
  success: boolean;
}

export interface ContinuousFarmActionsOptions {
  enabled(): boolean;
  /** Tool and selected crop identity. Any change ends this hold. */
  context(): string;
  /** Current read-only interaction result, reduced to the allowed adjacent field actions. */
  candidate(): FarmActionTarget | null;
  /** Dispatch one existing command and resolve only when its hit/animation is complete. */
  execute(target: FarmActionTarget): Promise<FarmActionOutcome>;
}

/** Sequential, transient coordinator. It never calculates farm rules or schedules an interval. */
export class ContinuousFarmActions {
  private active = false;
  private generation = 0;
  private heldContext = '';
  private readonly successful = new Set<string>();
  private stoppedBecause = 'not-started';

  constructor(private readonly options: ContinuousFarmActionsOptions) {}

  get isRunning(): boolean {
    return this.active;
  }

  get lastStopReason(): string {
    return this.stoppedBecause;
  }

  start(): void {
    if (this.active || !this.options.enabled()) return;
    const first = this.options.candidate();
    if (!first || !isFarmAction(first.action)) return;
    this.active = true;
    this.stoppedBecause = '';
    this.generation += 1;
    this.heldContext = this.options.context();
    this.successful.clear();
    void this.advance(this.generation);
  }

  stop(reason = 'explicit'): void {
    if (!this.active) return;
    this.active = false;
    this.stoppedBecause = reason;
    this.generation += 1;
    this.heldContext = '';
    this.successful.clear();
  }

  private async advance(generation: number): Promise<void> {
    if (!this.canContinue(generation)) return;
    const target = this.options.candidate();
    if (!target || !isFarmAction(target.action) || this.successful.has(identity(target))) {
      this.stop('no-valid-new-target');
      return;
    }

    let outcome: FarmActionOutcome;
    try {
      outcome = await this.options.execute(target);
    } catch {
      this.stop('execute-rejected');
      return;
    }
    if (generation !== this.generation || !this.active) return;
    if (!outcome.success || outcome.key !== target.key || outcome.action !== target.action) {
      this.stop('command-refused-or-mismatched');
      return;
    }
    this.successful.add(identity(target));
    void this.advance(generation);
  }

  private canContinue(generation: number): boolean {
    if (generation !== this.generation || !this.active) return false;
    if (!this.options.enabled() || this.options.context() !== this.heldContext) {
      this.stop('disabled-or-context-changed');
      return false;
    }
    return true;
  }
}

function isFarmAction(action: string): action is FarmActionKind {
  return action === 'till' || action === 'water' || action === 'plant';
}

function identity(target: FarmActionTarget): string {
  return `${target.key}\u0000${target.action}`;
}
