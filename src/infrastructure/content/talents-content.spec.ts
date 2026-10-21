import { describe, expect, it } from 'vitest';
import talents from '../../../content/talents.json';
import items from '../../../content/items.json';
import { SKILL_IDS } from '../../domain/skills';
import { talentsFileSchema } from './content-schema';

const parsed = talentsFileSchema.parse(talents);
const itemIds = new Set(items.items.map((i) => i.id));

describe('content/talents.json', () => {
  it('passes the schema', () => {
    expect(talentsFileSchema.safeParse(talents).success).toBe(true);
  });

  it('unlocks at skill level 5', () => {
    expect(parsed.unlockLevel).toBe(5);
  });

  it('only names skills that exist', () => {
    for (const talent of parsed.talents) expect(SKILL_IDS).toContain(talent.skill);
  });

  it('gives every skill exactly two talents to choose from', () => {
    for (const skill of SKILL_IDS) {
      expect(parsed.talents.filter((t) => t.skill === skill), skill).toHaveLength(2);
    }
  });

  it('has unique talent ids', () => {
    const ids = parsed.talents.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('refers only to items that exist when a talent is about one item', () => {
    for (const talent of parsed.talents) {
      if (talent.effect.type === 'extraYield' && talent.effect.item !== undefined) {
        expect(itemIds.has(talent.effect.item), talent.id).toBe(true);
      }
    }
  });

  it('keeps every chance between zero and one, and every percentage in range', () => {
    for (const talent of parsed.talents) {
      const effect = talent.effect;
      if (effect.type === 'extraYield') expect(effect.chance, talent.id).toBeGreaterThan(0);
      if (effect.type === 'extraYield') expect(effect.chance, talent.id).toBeLessThanOrEqual(1);
      if (effect.type === 'sellBonus') expect(effect.percent, talent.id).toBeGreaterThan(0);
    }
  });
});
