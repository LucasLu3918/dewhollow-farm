import { describe, expect, it } from 'vitest';
import { addPoints, favorQualityBonus, giftPoints, giftReaction, heartCapPoints, heartsOf, type Friendship, type FriendshipRules } from './friendship';

const RULES: FriendshipRules = {
  pointsPerHeart: 100,
  maxHearts: 10,
  earlyCap: { hearts: 4, untilSeason: 'summer' },
  talkPoints: 10,
  gift: { love: 80, neutral: 30, hate: -40 },
  cropQuality: { minHearts: 2, perResident: 0.05, cap: 0.15 },
};

function friendship(points: number): Friendship {
  return { points, talkedDay: null, giftedDay: null };
}

describe('顆心與上限', () => {
  it('每 100 點一顆心，最多 10 顆', () => {
    expect(heartsOf(0, RULES)).toBe(0);
    expect(heartsOf(199, RULES)).toBe(1);
    expect(heartsOf(200, RULES)).toBe(2);
    expect(heartsOf(5000, RULES)).toBe(10);
  });

  it('春夏（第 1–40 天，每季 20 天）的上限是 4 顆心，秋天起開放到 10 顆心', () => {
    expect(heartCapPoints(RULES, 20, 1)).toBe(400);
    expect(heartCapPoints(RULES, 20, 40)).toBe(400);
    expect(heartCapPoints(RULES, 20, 41)).toBe(1000);
  });

  it('加好感不會超過上限；已經超過上限時，加好感不會把它扣回去', () => {
    expect(addPoints(390, 30, 400)).toBe(400);
    expect(addPoints(500, 30, 400)).toBe(500);
    expect(addPoints(10, -40, 400)).toBe(0);
    expect(addPoints(100, -30, 400)).toBe(70);
  });
});

describe('送禮的反應', () => {
  const loves = ['crop.sweet-radish'];
  const hates = ['fish.carp'];

  it('依偏好分成喜歡、中立、討厭', () => {
    expect(giftReaction('crop.sweet-radish', loves, hates)).toBe('love');
    expect(giftReaction('fish.carp', loves, hates)).toBe('hate');
    expect(giftReaction('wood', loves, hates)).toBe('neutral');
  });

  it('好感變化來自內容的設定', () => {
    expect(giftPoints('love', RULES)).toBe(80);
    expect(giftPoints('neutral', RULES)).toBe(30);
    expect(giftPoints('hate', RULES)).toBe(-40);
  });
});

describe('居民喜歡的作物提高收成品質', () => {
  const residents = [
    { id: 'a', loves: ['crop.sweet-radish'] },
    { id: 'b', loves: ['crop.sweet-radish'] },
    { id: 'c', loves: ['crop.sweet-radish'] },
    { id: 'd', loves: ['crop.moon-bean'] },
  ];

  it('好感未達門檻（2 顆心）的居民不提供加成', () => {
    const bonus = favorQualityBonus('crop.sweet-radish', residents, { a: friendship(100) }, RULES);
    expect(bonus).toBe(0);
  });

  it('每位喜歡且好感達標的居民加一份，但總加成有上限', () => {
    const friendships = { a: friendship(200), b: friendship(250), c: friendship(400) };
    expect(favorQualityBonus('crop.sweet-radish', residents, friendships, RULES)).toBeCloseTo(0.15);
    const two = { a: friendship(200), b: friendship(250) };
    expect(favorQualityBonus('crop.sweet-radish', residents, two, RULES)).toBeCloseTo(0.1);
  });

  it('不喜歡這種作物的居民，不影響這種作物的品質', () => {
    const friendships = { d: friendship(900) };
    expect(favorQualityBonus('crop.sweet-radish', residents, friendships, RULES)).toBe(0);
  });
});
