export type PriceRowDto = {
  city: string;
  sellPriceMin: number;
  buyPriceMax: number;
  updatedAt: string;
  updatedAtEpoch: number | null;
  stale?: boolean;
};

export type PriceCacheEntry = {
  rows: PriceRowDto[];
  savedAt: number;
  itemIdForPrice: string;
  quality: number;
};

export function buildPriceCacheKey(itemIdForPrice: string, quality: number): string {
  return `${itemIdForPrice}:q${quality}`;
}

export function isMeaningfulPriceRow(row: PriceRowDto): boolean {
  if (row.updatedAtEpoch != null) return true;
  return row.sellPriceMin > 0 || row.buyPriceMax > 0;
}

/**
 * Merge fresh API rows with cached rows per city.
 * Fresh meaningful data replaces cache; missing cities keep cached values as stale.
 */
export function mergePriceRows(
  cached: PriceRowDto[],
  fresh: PriceRowDto[],
): { rows: PriceRowDto[]; hasStaleRows: boolean } {
  const byCity = new Map<string, PriceRowDto>();

  for (const row of cached) {
    if (!isMeaningfulPriceRow(row)) continue;
    byCity.set(row.city, { ...row, stale: true });
  }

  for (const row of fresh) {
    if (!isMeaningfulPriceRow(row)) continue;
    byCity.set(row.city, { ...row, stale: false });
  }

  const rows = [...byCity.values()].sort((a, b) => a.city.localeCompare(b.city));
  return {
    rows,
    hasStaleRows: rows.some((row) => row.stale),
  };
}
