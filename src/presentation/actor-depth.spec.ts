import { describe, expect, it } from 'vitest';
import { actorDepth, foregroundDepth } from './actor-depth';

describe('presentation actor depth', () => {
  it('orders actors by foot Y and keeps the player slightly ahead at equal Y', () => {
    expect(actorDepth(320, 'resident')).toBeLessThan(actorDepth(384, 'resident'));
    expect(actorDepth(320, 'player')).toBeGreaterThan(actorDepth(320, 'resident'));
  });

  it('places a foreground object just ahead of an actor at the same foot Y', () => {
    expect(foregroundDepth(320)).toBeGreaterThan(actorDepth(320, 'player'));
    expect(foregroundDepth(256)).toBeLessThan(actorDepth(320, 'resident'));
  });
});
