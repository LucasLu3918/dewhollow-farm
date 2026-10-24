import { describe, expect, it } from 'vitest';
import { RENDER_PROFILES, renderProfileFor } from './profiles';

describe('render profiles', () => {
  it('provides legacy, 32-pixel, and 16-pixel QA profiles without changing the default', () => {
    expect(RENDER_PROFILES.legacy.tilePixels).toBe(64);
    expect(RENDER_PROFILES.pixel32.tilePixels).toBe(32);
    expect(RENDER_PROFILES.pixel16.tilePixels).toBe(16);
    expect(RENDER_PROFILES.legacy.default).toBe(true);
    expect(RENDER_PROFILES.pixel32.qaOnly).toBe(true);
    expect(RENDER_PROFILES.pixel16.qaOnly).toBe(true);
  });

  it('resolves a profile by id and falls back to legacy for unknown values', () => {
    expect(renderProfileFor('pixel32')).toBe(RENDER_PROFILES.pixel32);
    expect(renderProfileFor('unknown')).toBe(RENDER_PROFILES.legacy);
  });
});
