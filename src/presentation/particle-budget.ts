/** Maximum number of short-lived action-particle objects held by one Phaser scene. */
export const MAX_ACTION_PARTICLES_PER_SCENE = 64;

/** Small idempotent leases keep concurrent action bursts within a scene-local ceiling. */
export class ParticleBudget {
  private active = 0;

  constructor(private readonly limit = MAX_ACTION_PARTICLES_PER_SCENE) {
    if (!Number.isInteger(limit) || limit < 0) throw new RangeError('Particle budget limit must be a non-negative integer.');
  }

  get activeCount(): number {
    return this.active;
  }

  acquire(): (() => void) | null {
    if (this.active >= this.limit) return null;
    this.active += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
    };
  }
}

const budgets = new WeakMap<object, ParticleBudget>();

/** Uses weak scene keys so stopped scenes do not remain reachable through the budget registry. */
export function reserveSceneParticle(scene: object): (() => void) | null {
  let budget = budgets.get(scene);
  if (!budget) {
    budget = new ParticleBudget();
    budgets.set(scene, budget);
  }
  return budget.acquire();
}
