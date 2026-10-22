import { describe, expect, it } from 'vitest';
import type { ContentPack } from '../../domain/content';
import { shippedPack } from '../../../tests/sim/shipped-content';

/**
 * M5d 的時數驗收（docs/PLAYTIME_PLAN.md 第 6 節）：把春與夏的內容單位的 playMinutes 加總，至少 120 分鐘。
 * 單位取自現有的內容檔：委託、信件、心形事件、主線、節慶（含星河兌換）、修復、隨機事件、居民、合成、圖鑑與成就。
 * 沒有標註季節的單位（居民、合成）視為春夏；有標註的只看 phase（或 season、seasons）是不是春或夏。
 */

interface Unit {
  label: string;
  minutes: number;
  /** 這個單位可在哪些季節遇到；null 表示內容沒有標註，依 PLAYTIME_PLAN 視為春夏。 */
  seasons: string[] | null;
}

function unitsOf(pack: ContentPack): Unit[] {
  const units: Unit[] = [];
  for (const q of pack.quests?.defs ?? []) units.push({ label: `委託 ${q.id}`, minutes: q.playMinutes, seasons: [q.phase] });
  for (const l of pack.letters ?? []) units.push({ label: `信件 ${l.id}`, minutes: l.playMinutes, seasons: [l.phase] });
  for (const e of pack.heartEvents) units.push({ label: `心形事件 ${e.id}`, minutes: e.playMinutes, seasons: [e.phase] });
  for (const c of pack.chapters ?? []) units.push({ label: `主線 ${c.id}`, minutes: c.playMinutes, seasons: [c.phase] });
  for (const f of pack.festivals ?? []) {
    units.push({ label: `節慶 ${f.id}`, minutes: f.playMinutes, seasons: [f.season] });
    for (const line of f.exchange ?? []) units.push({ label: `星河兌換 ${line.id}`, minutes: line.playMinutes, seasons: [f.season] });
  }
  for (const r of pack.repairs ?? []) units.push({ label: `修復 ${r.id}`, minutes: r.playMinutes, seasons: [r.season] });
  for (const e of pack.randomEvents?.events ?? []) units.push({ label: `隨機事件 ${e.id}`, minutes: e.playMinutes, seasons: e.seasons });
  for (const n of pack.npcs) units.push({ label: `居民 ${n.id}`, minutes: n.playMinutes, seasons: null });
  for (const r of pack.crafting) units.push({ label: `合成 ${r.id}`, minutes: r.playMinutes, seasons: null });
  for (const a of pack.achievements ?? []) units.push({ label: `成就 ${a.id}`, minutes: a.playMinutes, seasons: [a.phase] });
  for (const c of pack.collection ?? []) units.push({ label: `圖鑑 ${c.id}`, minutes: c.playMinutes, seasons: [c.phase] });
  return units;
}

function isSpringOrSummer(unit: Unit): boolean {
  return unit.seasons === null || unit.seasons.some((s) => s === 'spring' || s === 'summer');
}

describe('春夏的時數驗收（PLAYTIME_PLAN 第 6 節）', () => {
  it('every content unit has a positive playMinutes', () => {
    for (const unit of unitsOf(shippedPack)) {
      expect(unit.minutes, unit.label).toBeGreaterThan(0);
    }
  });

  it('春與夏的內容單位加總至少 120 分鐘', () => {
    const total = unitsOf(shippedPack).filter(isSpringOrSummer).reduce((sum, unit) => sum + unit.minutes, 0);
    expect(total).toBeGreaterThanOrEqual(120);
  });

  it('圖鑑與成就的單位算在春夏的合計裡（不是只算主線與委託）', () => {
    const units = unitsOf(shippedPack).filter(isSpringOrSummer);
    const dex = units.filter((u) => u.label.startsWith('圖鑑 ') || u.label.startsWith('成就 '));
    expect(dex.length).toBe((shippedPack.achievements ?? []).length + (shippedPack.collection ?? []).length);
  });
});
