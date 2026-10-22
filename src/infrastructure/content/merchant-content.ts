import { SEASONS, type Season } from '../../domain/calendar';
import type { ContentPack } from '../../domain/content';
import { cropItems } from '../../domain/items';
import { keepsPathsOpen, HOUSE_ROOMS } from '../../domain/decor';

/**
 * 旅行商人與小屋的交叉檢查（見 load-content.ts）：
 * 候選的物品要存在、只能是種子或裝飾、價格要高於同一件在別處的售價；名額要在每個季節都排得滿；
 * 不能跟行商商隊（週五、六會遇到的隨機事件）送的東西重複；旅行商人的櫃檯與貨架要成對；
 * 小屋的每一間（不擺東西時）服務點都要走得到。
 */
export function merchantProblems(pack: ContentPack): string[] {
  const problems: string[] = [];
  // 沒有旅行商人的內容（測試用的最小內容）時，輪換貨架的櫃檯就沒有貨可賣（見 game-commands.ts 的 buyFromMerchant）。
  const merchant = pack.merchant;
  if (!merchant) return problems;
  const rotating = pack.shops.filter((shop) => shop.rotating === true);
  if (rotating.length === 0) problems.push('旅行商人有內容，卻沒有 rotating 的櫃檯商店（content/shops.json）');
  for (const shop of rotating) {
    if (shop.stock.length > 0) problems.push(`輪換貨架的商店 ${shop.id} 不能有固定貨架（stock 要是空的）`);
  }

  const items = [...pack.items, ...cropItems(pack.crops)];
  const seen = new Set<string>();
  for (const candidate of merchant.candidates) {
    const label = `旅行商人的候選 ${candidate.itemId}`;
    if (seen.has(candidate.itemId)) problems.push(`${label} 重複`);
    seen.add(candidate.itemId);
    const item = items.find((i) => i.id === candidate.itemId);
    if (!item) {
      problems.push(`${label} 不存在`);
      continue;
    }
    if (item.kind !== 'seed' && item.kind !== 'decor') problems.push(`${label} 的分類是 ${item.kind}，旅行商人只賣種子與裝飾`);
    for (const shop of pack.shops) {
      if (shop.rotating) continue;
      for (const line of shop.stock) {
        if (line.itemId === candidate.itemId && candidate.price <= line.price) {
          problems.push(`${label} 的價格 ${candidate.price} 不高於 ${shop.name} 的 ${line.price}`);
        }
      }
    }
  }

  for (const season of SEASONS) {
    const count = merchant.candidates.filter((c) => !c.seasons || c.seasons.includes(season as Season)).length;
    if (count < merchant.slots.min) problems.push(`${season} 的旅行商人候選只有 ${count} 件，少於名額下限 ${merchant.slots.min}`);
  }

  // 行商商隊（隨機事件，只在週五、六出現）送的東西，不放進旅行商人的貨架，避免同一件兩處都能拿。
  const caravanGifts = new Set<string>();
  for (const event of pack.randomEvents?.events ?? []) {
    if (event.effect.type !== 'grant') continue;
    if (!event.weekdays.some((d) => merchant.weekdays.includes(d))) continue;
    for (const itemId of Object.keys(event.effect.items)) caravanGifts.add(itemId);
  }
  for (const candidate of merchant.candidates) {
    if (caravanGifts.has(candidate.itemId)) problems.push(`旅行商人的候選 ${candidate.itemId} 和隨機事件重複送出（行商商隊）`);
  }

  if (merchant.weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) problems.push('旅行商人的來訪星期要在 0 到 6 之間');
  return problems;
}

/** 小屋的每一間（沒有擺裝飾時）服務點都要從出生點走得到，裝飾才有地方擺。 */
export function housePathProblems(pack: ContentPack): string[] {
  const problems: string[] = [];
  for (const map of pack.maps) {
    if (!HOUSE_ROOMS.includes(map.id)) continue;
    if (!Object.values(map.legend).some((tile) => tile.wardrobe === true)) problems.push(`小屋 ${map.id} 沒有衣櫃（legend 的 wardrobe）`);
    if (!keepsPathsOpen(map, [])) problems.push(`小屋 ${map.id} 的服務點不是每個都走得到`);
  }
  return problems;
}
