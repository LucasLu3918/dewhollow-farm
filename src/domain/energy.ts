import { fail, ok, type Result } from './result';

export interface Energy {
  current: number;
  max: number;
}

export function createEnergy(max: number): Energy {
  return { current: max, max };
}

export function canSpend(energy: Energy, cost: number): boolean {
  return energy.current >= cost;
}

export function trySpend(energy: Energy, cost: number): Result<Energy, 'NOT_ENOUGH_ENERGY'> {
  if (!canSpend(energy, cost)) return fail('NOT_ENOUGH_ENERGY');
  return ok({ ...energy, current: energy.current - cost });
}

export function restore(energy: Energy): Energy {
  return { ...energy, current: energy.max };
}
