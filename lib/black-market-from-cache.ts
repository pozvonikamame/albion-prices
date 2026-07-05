import {
  getItemByNumericId,
  lookupItemByPriceId,
  getItemCapabilities,
} from "@/lib/items";
import type { PriceCacheEntry, PriceRowDto } from "@/lib/price-cache";
import { getAllPriceCacheEntries } from "@/lib/price-cache-store";
import type { BlackMarketRow } from "@/lib/black-market-store";

const BLACK_MARKET = "Black Market";

function rowFromPriceCacheEntry(entry: PriceCacheEntry): BlackMarketRow | null {
  const bm = entry.rows.find(
    (row) => row.city === BLACK_MARKET && row.buyPriceMax > 0,
  );
  if (!bm) return null;

  const resolved = lookupItemByPriceId(entry.itemIdForPrice);
  if (!resolved) return null;

  const { item, enchant } = resolved;
  const capabilities = getItemCapabilities(item);

  return {
    itemId: item.id,
    priceItemId: entry.itemIdForPrice,
    uniqueName: item.uniqueName,
    baseUniqueName: item.baseUniqueName,
    name: item.name,
    ruName: item.ruName,
    baseName: item.baseName,
    tier: item.tier,
    enchant,
    quality: entry.quality,
    buyPriceMax: bm.buyPriceMax,
    updatedAt: bm.updatedAt,
    updatedAtEpoch: bm.updatedAtEpoch,
    enchantStyle: capabilities.enchantStyle,
  };
}

/** BM buy orders already loaded via Price Checker (price-cache.json). */
export function blackMarketRowsFromPriceCache(): BlackMarketRow[] {
  const rows: BlackMarketRow[] = [];
  for (const entry of getAllPriceCacheEntries()) {
    const row = rowFromPriceCacheEntry(entry);
    if (row) rows.push(row);
  }
  return rows;
}

export function blackMarketRowFromPriceFetch(
  itemId: number,
  priceItemId: string,
  quality: number,
  priceRows: PriceRowDto[],
): BlackMarketRow | null {
  const bm = priceRows.find(
    (row) => row.city === BLACK_MARKET && row.buyPriceMax > 0,
  );
  if (!bm) return null;

  const item = getItemByNumericId(itemId);
  if (!item) return null;

  const resolved = lookupItemByPriceId(priceItemId);
  const enchant = resolved?.enchant ?? 0;
  const capabilities = getItemCapabilities(item);

  return {
    itemId: item.id,
    priceItemId,
    uniqueName: item.uniqueName,
    baseUniqueName: item.baseUniqueName,
    name: item.name,
    ruName: item.ruName,
    baseName: item.baseName,
    tier: item.tier,
    enchant,
    quality,
    buyPriceMax: bm.buyPriceMax,
    updatedAt: bm.updatedAt,
    updatedAtEpoch: bm.updatedAtEpoch,
    enchantStyle: capabilities.enchantStyle,
  };
}
