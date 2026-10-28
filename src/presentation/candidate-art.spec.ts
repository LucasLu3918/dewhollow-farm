import { describe, expect, it } from 'vitest';
import { resolveCandidateArt } from './candidate-art';

describe('resolveCandidateArt', () => {
  it('maps supported 8-bit world art onto the 16px atlas at a 4x tile scale', () => {
    expect(resolveCandidateArt('pixel16', 'tile.grass')).toEqual({
      atlas: 'gate1-candidate-atlas',
      frame: 'grass',
      scale: 4,
      candidate: '8bit',
    });
  });

  it('maps supported 16-bit world art onto the 32px atlas at a 2x tile scale', () => {
    expect(resolveCandidateArt('pixel32', 'tile.path')).toEqual({
      atlas: 'gate1-candidate-atlas',
      frame: 'road',
      scale: 2,
      candidate: '16bit',
    });
  });

  it('maps crop overlays to a stage-specific candidate frame', () => {
    expect(resolveCandidateArt('pixel32', 'crop.sweet-radish', 'sprout')?.frame).toBe('cropSprout');
    expect(resolveCandidateArt('pixel32', 'crop.sweet-radish', 'growing-1')).toBeNull();
    expect(resolveCandidateArt('pixel32', 'crop.moon-bean', 'sprout')).toBeNull();
    expect(resolveCandidateArt('pixel16', 'crop.moon-bean', 'sprout')).toBeNull();
    expect(resolveCandidateArt('pixel16', 'tile.field')?.frame).toBe('tilled');
    expect(resolveCandidateArt('pixel16', 'tile.soil')).toBeNull();
  });

  it('keeps unsupported and legacy assets on the formal texture path', () => {
    expect(resolveCandidateArt('legacy', 'tile.grass')).toBeNull();
    expect(resolveCandidateArt('pixel32', 'player.down')).toBeNull();
    expect(resolveCandidateArt('pixel16', 'pet.cat')).toBeNull();
    expect(resolveCandidateArt('pixel32', 'tile.water')).toBeNull();
    expect(resolveCandidateArt('pixel32', 'item.cheese')).toBeNull();
  });
});
