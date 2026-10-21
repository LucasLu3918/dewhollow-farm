import { describe, expect, it } from 'vitest';
import type { SoundRecipe } from '../../infrastructure/content/content-schema';
import { frequencyAt, renderSound } from './synth';

const RATE = 8000;

const tone: SoundRecipe = {
  voices: [{ wave: 'sine', from: 440, to: 440, start: 0, duration: 0.5, gain: 0.5, attack: 0.05 }],
};

describe('renderSound', () => {
  it('is as long as the last voice ends', () => {
    const late: SoundRecipe = {
      voices: [
        { wave: 'sine', from: 300, to: 300, start: 0.1, duration: 0.2, gain: 0.3, attack: 0 },
        { wave: 'square', from: 500, to: 500, start: 0.25, duration: 0.15, gain: 0.2, attack: 0 },
      ],
    };
    expect(renderSound(late, RATE).length).toBe(Math.ceil(0.4 * RATE));
  });

  it('is silent before a voice starts', () => {
    const samples = renderSound({ voices: [{ wave: 'sine', from: 600, to: 600, start: 0.2, duration: 0.2, gain: 1, attack: 0 }] }, RATE);
    const before = samples.slice(0, Math.floor(0.2 * RATE) - 1);
    expect(before.every((s) => s === 0)).toBe(true);
  });

  it('ramps up to the voice gain at the end of its attack and fades out to nothing by the end', () => {
    const samples = renderSound(tone, RATE);
    const peak = Math.max(...Array.from(samples, (s) => Math.abs(s)));
    expect(peak).toBeGreaterThan(0.45);
    expect(peak).toBeLessThanOrEqual(0.5 + 1e-6);
    const tail = Math.max(...Array.from(samples.slice(samples.length - 5), (s) => Math.abs(s)));
    expect(tail).toBeLessThan(0.01);
  });

  it('starts quietly when the attack is long', () => {
    const slow: SoundRecipe = { voices: [{ wave: 'sine', from: 440, to: 440, start: 0, duration: 0.5, gain: 1, attack: 0.25 }] };
    const samples = renderSound(slow, RATE);
    const early = Math.max(...Array.from(samples.slice(0, 20), (s) => Math.abs(s)));
    expect(early).toBeLessThan(0.1);
  });

  it('keeps the output within -1 to 1 even when voices add up', () => {
    const loud: SoundRecipe = {
      voices: Array.from({ length: 4 }, () => ({ wave: 'square' as const, from: 220, to: 220, start: 0, duration: 0.3, gain: 1, attack: 0 })),
    };
    for (const s of renderSound(loud, RATE)) {
      expect(Number.isFinite(s)).toBe(true);
      expect(Math.abs(s)).toBeLessThanOrEqual(1);
    }
  });

  it('scales the whole sound by the master volume', () => {
    const full = renderSound(tone, RATE, 1);
    const half = renderSound(tone, RATE, 0.5);
    for (let i = 0; i < full.length; i += 97) expect(half[i]).toBeCloseTo((full[i] ?? 0) * 0.5, 6);
  });

  it('is deterministic: the same recipe renders the same noise every time', () => {
    const hiss: SoundRecipe = { voices: [{ wave: 'noise', from: 1, to: 1, start: 0, duration: 0.2, gain: 0.4, attack: 0 }] };
    expect(Array.from(renderSound(hiss, RATE))).toEqual(Array.from(renderSound(hiss, RATE)));
  });

  it('gives noise that is not a plain tone (values spread across the range)', () => {
    const hiss: SoundRecipe = { voices: [{ wave: 'noise', from: 1, to: 1, start: 0, duration: 0.2, gain: 1, attack: 0 }] };
    const samples = Array.from(renderSound(hiss, RATE));
    expect(Math.max(...samples)).toBeGreaterThan(0.3);
    expect(Math.min(...samples)).toBeLessThan(-0.3);
  });

  it('has no NaN and no empty output for a voice of any length', () => {
    const blip: SoundRecipe = { voices: [{ wave: 'triangle', from: 900, to: 300, start: 0, duration: 0.01, gain: 0.8, attack: 0 }] };
    const samples = renderSound(blip, RATE);
    expect(samples.length).toBeGreaterThan(0);
    expect(samples.some((s) => Number.isNaN(s))).toBe(false);
  });
});

describe('frequencyAt', () => {
  it('stays put when from and to are the same', () => {
    expect(frequencyAt({ from: 440, to: 440, duration: 1 }, 0.7)).toBeCloseTo(440, 10);
  });

  it('sweeps evenly in pitch: halfway is the geometric mean, not the arithmetic one', () => {
    expect(frequencyAt({ from: 200, to: 800, duration: 1 }, 0.5)).toBeCloseTo(400, 6);
  });

  it('lands on the target at the end and starts from the source', () => {
    expect(frequencyAt({ from: 200, to: 800, duration: 1 }, 0)).toBeCloseTo(200, 10);
    expect(frequencyAt({ from: 200, to: 800, duration: 1 }, 1)).toBeCloseTo(800, 10);
  });
});
