import { describe, expect, it } from 'vitest';
import type { TalentSet } from '../domain/talents';
import type { GameState } from '../domain/game-state';
import { pendingTalentSkills, skillRows } from './skill-panel';

const THRESHOLDS = [0, 20, 50, 90, 140, 200, 270, 350, 440, 540, 650];

const talentSet: TalentSet = {
  unlockLevel: 5,
  defs: [
    { id: 'bountiful', skill: 'farming', name: '豐收手', description: '收成多一件的機率 +25%', effect: { type: 'extraYield', action: 'harvest', chance: 0.25 } },
    { id: 'market-sense', skill: 'farming', name: '行商眼', description: '作物售價 +10%', effect: { type: 'sellBonus', kinds: ['crop'], percent: 10 } },
    { id: 'wild-nose', skill: 'foraging', name: '野地鼻', description: '野菜多一份的機率 +25%', effect: { type: 'extraYield', action: 'forage', chance: 0.25 } },
    { id: 'keen-bite', skill: 'fishing', name: '好手氣', description: '上鉤機率 +10', effect: { type: 'biteBonus', points: 10 } },
    { id: 'ore-sense', skill: 'mining', name: '礦脈眼', description: '礦石多一個的機率 +25%', effect: { type: 'extraYield', action: 'mine', item: 'copper-ore', chance: 0.25 } },
    { id: 'hearty-cook', skill: 'cooking', name: '好食量', description: '體力 +2', effect: { type: 'dishEnergy', amount: 2 } },
  ],
};

/** 技能面板只看技能經驗與已選天賦，所以測試只給這兩項。 */
function withSkills(xp: Partial<GameState['skills']>, talents: GameState['talents'] = {}): Pick<GameState, 'skills' | 'talents'> {
  return { skills: { farming: 0, foraging: 0, fishing: 0, mining: 0, cooking: 0, ...xp }, talents };
}

describe('skillRows', () => {
  it('lists the five skills in order with their levels', () => {
    const rows = skillRows(withSkills({ farming: 0 }), THRESHOLDS, talentSet);
    expect(rows.map((r) => r.skill)).toEqual(['farming', 'foraging', 'fishing', 'mining', 'cooking']);
    expect(rows[0]).toMatchObject({ name: '耕作', level: 0 });
  });

  it('locks a skill below level 5 and offers nothing yet', () => {
    const row = skillRows(withSkills({ farming: 199 }), THRESHOLDS, talentSet)[0];
    expect(row).toMatchObject({ status: 'locked', options: [], chosen: null });
  });

  it('offers the two talents of a skill that reached level 5 and has no choice yet', () => {
    const row = skillRows(withSkills({ farming: 200 }), THRESHOLDS, talentSet)[0];
    expect(row?.status).toBe('choose');
    expect(row?.options.map((t) => t.id)).toEqual(['bountiful', 'market-sense']);
  });

  it('shows only the chosen talent after a choice is made', () => {
    const row = skillRows(withSkills({ farming: 200 }, { farming: 'market-sense' }), THRESHOLDS, talentSet)[0];
    expect(row).toMatchObject({ status: 'chosen', options: [] });
    expect(row?.chosen?.name).toBe('行商眼');
  });
});

describe('pendingTalentSkills', () => {
  it('names the skills at level 5 that still wait for a choice', () => {
    const state = withSkills({ farming: 200, foraging: 200, mining: 50 }, { foraging: 'wild-nose' });
    expect(pendingTalentSkills(state, THRESHOLDS, talentSet)).toEqual(['farming']);
  });
});
