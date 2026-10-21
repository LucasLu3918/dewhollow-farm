import { describe, expect, it } from 'vitest';
import palette from '../../content/palette.json';
import type { GameEvent } from '../application/game-commands';
import { EMOTES, EMOTE_KINDS, emotesForEvent } from './emote-defs';

describe('emote definitions', () => {
  it('has the six emotes the effects plan asks for', () => {
    expect([...EMOTE_KINDS].sort()).toEqual(['heart', 'note', 'question', 'sleepy', 'surprise', 'sweat']);
    for (const kind of EMOTE_KINDS) expect(EMOTES[kind].kind).toBe(kind);
  });

  it('draws every colour from the shared palette, so no asset needs re-quantizing for an emote', () => {
    for (const kind of EMOTE_KINDS) {
      const { icon, outline, fill } = EMOTES[kind];
      for (const hex of [icon, outline, fill]) {
        expect(hex, `${kind} ${hex}`).toMatch(/^#[0-9a-f]{6}$/);
        expect(palette.colors, `${kind} ${hex}`).toContain(hex);
      }
    }
  });

  it('shares one bubble: the outline colour and the fill colour are the same for every emote', () => {
    expect(new Set(EMOTE_KINDS.map((k) => EMOTES[k].outline))).toEqual(new Set([palette.anchors.outline]));
    expect(new Set(EMOTE_KINDS.map((k) => EMOTES[k].fill))).toEqual(new Set([palette.anchors.highlight]));
  });

  it('uses the brand colours from CHARACTERS.md where they fit: pink for love, blue for the question', () => {
    expect(EMOTES.heart.icon).toBe(palette.anchors.xiaohan);
    expect(EMOTES.question.icon).toBe(palette.anchors.maomao);
  });

  it('keeps the icon readable against the white bubble: it differs from the fill', () => {
    for (const kind of EMOTE_KINDS) expect(EMOTES[kind].icon, kind).not.toBe(EMOTES[kind].fill);
  });
});

describe('emotesForEvent: who shows what', () => {
  const talked = (extra: Partial<Extract<GameEvent, { type: 'talked' }>> = {}): GameEvent => ({
    type: 'talked',
    npcId: 'maomao',
    first: false,
    gifted: false,
    ...extra,
  });

  it('shows love over a villager who has just given the player a gift', () => {
    expect(emotesForEvent(talked({ first: true, gifted: true }))).toEqual([{ who: { npc: 'maomao' }, kind: 'heart' }]);
  });

  it('shows surprise when a first meeting could not hand over the gift', () => {
    expect(emotesForEvent(talked({ first: true, gifted: false }))).toEqual([{ who: { npc: 'maomao' }, kind: 'surprise' }]);
  });

  it('shows a happy note over a villager on every later talk', () => {
    expect(emotesForEvent(talked())).toEqual([{ who: { npc: 'maomao' }, kind: 'note' }]);
  });

  it('shows the player a sweat drop when there is no energy, surprise when the bag is full, and a question otherwise', () => {
    const refused = (reason: string): GameEvent => ({ type: 'refused', reason });
    expect(emotesForEvent(refused('NOT_ENOUGH_ENERGY'))).toEqual([{ who: 'player', kind: 'sweat' }]);
    expect(emotesForEvent(refused('BAG_FULL'))).toEqual([{ who: 'player', kind: 'surprise' }]);
    for (const reason of ['NO_SOIL', 'NO_SEED', 'NO_CROP', 'NOT_RIPE', 'ALREADY_TILLED', 'ALREADY_PLANTED', 'NOTHING_HERE', 'NO_SHIPPABLE']) {
      expect(emotesForEvent(refused(reason)), reason).toEqual([{ who: 'player', kind: 'question' }]);
    }
  });

  it('shows the player a sleepy Z when going to bed and a note after a harvest', () => {
    expect(emotesForEvent({ type: 'slept' })).toEqual([{ who: 'player', kind: 'sleepy' }]);
    expect(emotesForEvent({ type: 'acted', action: 'harvest', x: 1, y: 1 })).toEqual([{ who: 'player', kind: 'note' }]);
  });

  it('shows the heart event’s own emote over the villager who starts it', () => {
    expect(emotesForEvent({ type: 'heartEvent', npcId: 'a-gan', eventId: 'a-gan-heart-1', emote: 'question' })).toEqual([
      { who: { npc: 'a-gan' }, kind: 'question' },
    ]);
  });

  it('shows a heart for a loved gift, a sweat drop for a disliked one, and a note for a neutral one', () => {
    expect(emotesForEvent({ type: 'gifted', npcId: 'maomao', reaction: 'love' })).toEqual([{ who: { npc: 'maomao' }, kind: 'heart' }]);
    expect(emotesForEvent({ type: 'gifted', npcId: 'maomao', reaction: 'hate' })).toEqual([{ who: { npc: 'maomao' }, kind: 'sweat' }]);
    expect(emotesForEvent({ type: 'gifted', npcId: 'maomao', reaction: 'neutral' })).toEqual([{ who: { npc: 'maomao' }, kind: 'note' }]);
  });

  it('shows nothing for events that need no reaction', () => {
    expect(emotesForEvent({ type: 'acted', action: 'till', x: 1, y: 1 })).toEqual([]);
    expect(emotesForEvent({ type: 'acted', action: 'ship', x: 1, y: 1 })).toEqual([]);
    expect(emotesForEvent({ type: 'enteredMap', mapId: 'farm' })).toEqual([]);
    expect(emotesForEvent({ type: 'saveRequested' })).toEqual([]);
  });
});
