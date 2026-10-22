import { describe, expect, it } from 'vitest';
import { FONT_SIZES } from '../domain/settings';
import { fontScaleOf, levelMarker, reducedEffects } from './accessibility';

describe('font size steps', () => {
  it('has three steps, standard, large and extra large, scaling up', () => {
    expect(FONT_SIZES).toEqual(['standard', 'large', 'xlarge']);
    const scales = FONT_SIZES.map(fontScaleOf);
    expect(scales[0]).toBe(1);
    expect(scales[1]).toBeGreaterThan(scales[0] ?? 0);
    expect(scales[2]).toBeGreaterThan(scales[1] ?? 0);
  });
});

describe('colour-blind markers', () => {
  it('adds a text mark to errors and to results so they are not told apart by red alone', () => {
    expect(levelMarker('error', true)).not.toBe('');
    expect(levelMarker('info', true)).not.toBe('');
    expect(levelMarker('error', true)).not.toBe(levelMarker('info', true));
  });

  it('adds no mark when the mode is off, so the default text is unchanged', () => {
    expect(levelMarker('error', false)).toBe('');
    expect(levelMarker('info', false)).toBe('');
  });
});

describe('effect gates', () => {
  it('turns every effect on by default when the system does not ask for reduced motion', () => {
    expect(reducedEffects(false, { shake: true, flash: true, particles: true })).toEqual({
      shake: true,
      flash: true,
      particles: true,
    });
  });

  it('turns every effect off when the system asks for reduced motion, whatever the switches say', () => {
    expect(reducedEffects(true, { shake: true, flash: true, particles: true })).toEqual({
      shake: false,
      flash: false,
      particles: false,
    });
  });

  it('turns off only the effects the player switched off', () => {
    expect(reducedEffects(false, { shake: false, flash: true, particles: true })).toEqual({
      shake: false,
      flash: true,
      particles: true,
    });
  });
});
