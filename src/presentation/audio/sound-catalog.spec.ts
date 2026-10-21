import { describe, expect, it } from 'vitest';
import sounds from '../../../content/sounds.json';
import terrain from '../../../content/terrain.json';
import type { SoundRecipe } from '../../infrastructure/content/content-schema';
import { renderSound } from './synth';
import { ACTION_SOUND, SOUND_IDS } from './sound-ids';

/** 音效目錄：程式用到的每一個音效都必須在 content/sounds.json 裡，且能正確合成。 */
describe('sound catalog', () => {
  const catalog = sounds.sounds as Record<string, SoundRecipe>;

  it('defines every sound id the game plays', () => {
    for (const id of SOUND_IDS) expect(catalog[id], id).toBeDefined();
  });

  it('maps every farm action to a sound that exists', () => {
    expect(Object.keys(ACTION_SOUND).sort()).toEqual(['harvest', 'plant', 'ship', 'till', 'water']);
    for (const id of Object.values(ACTION_SOUND)) expect(SOUND_IDS).toContain(id);
  });

  it('keeps the terrain footsteps pointing at real sounds', () => {
    for (const entry of terrain.terrains) expect(catalog[entry.footstep.sound], entry.kind).toBeDefined();
  });

  it('renders every sound audibly, within 1 second and inside full scale', () => {
    for (const [id, recipe] of Object.entries(catalog)) {
      const samples = renderSound(recipe, 8000, sounds.master);
      expect(samples.length, id).toBeGreaterThan(0);
      expect(samples.length / 8000, id).toBeLessThanOrEqual(1);
      const peak = Math.max(...Array.from(samples, (s) => Math.abs(s)));
      expect(peak, id).toBeGreaterThan(0.02);
      expect(peak, id).toBeLessThanOrEqual(1);
    }
  });
});
