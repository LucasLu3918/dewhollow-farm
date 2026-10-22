import type { Season } from './calendar';
import type { ShopDef, ShopStock } from './content';

/**
 * 貨架的季節進貨（shops.json 的 seasons）：省略 seasons 的商品四季都有；有 seasons 的只在那些季節上架。
 * 換季時不在季節內的商品下架：買不到，也不列在貨架上（見 game-commands.ts 的 buy 與 shop-panel.ts）。
 */

/** 這一項商品在這個季節是否上架。 */
export function onSale(line: ShopStock, season: Season): boolean {
  return !line.seasons || line.seasons.includes(season);
}

/** 這個季節貨架上的所有商品（順序與 shops.json 相同）。 */
export function stockFor(shop: ShopDef, season: Season): ShopStock[] {
  return shop.stock.filter((line) => onSale(line, season));
}
