import { describe, expect, it } from 'vitest';
import { readyHeartEvent, type HeartEventDef } from './heart-events';

function event(id: string, npcId: string, hearts: number, mapId: string, periods: HeartEventDef['periods']): HeartEventDef {
  return {
    id,
    npcId,
    hearts,
    phase: 'spring',
    mapId,
    periods,
    emote: 'heart',
    pages: ['第一頁', '第二頁'],
    options: [{ id: 'kind', label: '好', reply: '謝謝你。', points: 30 }],
    playMinutes: 2.5,
  };
}

const EVENTS: HeartEventDef[] = [
  event('a-2', 'a', 2, 'village', ['morning']),
  event('a-4', 'a', 4, 'plaza', ['noon']),
  event('b-2', 'b', 2, 'village', ['morning']),
];

describe('心形事件的觸發', () => {
  it('好感達到顆心數、地點與時段都符合時才觸發', () => {
    const found = readyHeartEvent(EVENTS, 'a', { hearts: 2, mapId: 'village', period: 'morning', triggered: [] });
    expect(found?.id).toBe('a-2');
  });

  it('好感不足、地點不對或時段不對都不觸發', () => {
    expect(readyHeartEvent(EVENTS, 'a', { hearts: 1, mapId: 'village', period: 'morning', triggered: [] })).toBeNull();
    expect(readyHeartEvent(EVENTS, 'a', { hearts: 2, mapId: 'plaza', period: 'morning', triggered: [] })).toBeNull();
    expect(readyHeartEvent(EVENTS, 'a', { hearts: 2, mapId: 'village', period: 'evening', triggered: [] })).toBeNull();
  });

  it('同一個事件只觸發一次（已觸發的不再出現）', () => {
    const found = readyHeartEvent(EVENTS, 'a', { hearts: 4, mapId: 'village', period: 'morning', triggered: ['a-2'] });
    expect(found).toBeNull();
    const later = readyHeartEvent(EVENTS, 'a', { hearts: 4, mapId: 'plaza', period: 'noon', triggered: ['a-2'] });
    expect(later?.id).toBe('a-4');
  });

  it('只看這位居民的事件', () => {
    expect(readyHeartEvent(EVENTS, 'b', { hearts: 4, mapId: 'plaza', period: 'noon', triggered: [] })).toBeNull();
  });

  it('同一位居民有多個可觸發的事件時，先觸發顆心較少的', () => {
    const both = [event('a-4', 'a', 4, 'village', ['morning']), event('a-2', 'a', 2, 'village', ['morning'])];
    const found = readyHeartEvent(both, 'a', { hearts: 4, mapId: 'village', period: 'morning', triggered: [] });
    expect(found?.id).toBe('a-2');
  });
});
