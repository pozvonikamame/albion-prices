import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildPriceCacheKey,
  mergePriceRows,
  type PriceCacheEntry,
  type PriceRowDto,
} from "@/lib/price-cache";

const CACHE_DIR = join(process.cwd(), ".cache");
const CACHE_FILE = join(CACHE_DIR, "price-cache.json");

let store = new Map<string, PriceCacheEntry>();

function loadFromDisk(): void {
  try {
    if (!existsSync(CACHE_FILE)) return;
    const parsed = JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Record<
      string,
      PriceCacheEntry
    >;
    store = new Map(Object.entries(parsed));
  } catch {
    store = new Map();
  }
}

function saveToDisk(): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    const payload = Object.fromEntries(store.entries());
    writeFileSync(CACHE_FILE, JSON.stringify(payload), "utf8");
  } catch {
    // Ignore on read-only filesystems (e.g. some serverless hosts).
  }
}

loadFromDisk();

export function getStoredPrices(key: string): PriceCacheEntry | undefined {
  return store.get(key);
}

export function resolvePricesWithCache(
  key: string,
  itemIdForPrice: string,
  quality: number,
  freshRows: PriceRowDto[],
): { rows: PriceRowDto[]; hasStaleRows: boolean; savedAt: number | null } {
  const cached = store.get(key);
  const { rows, hasStaleRows } = mergePriceRows(cached?.rows ?? [], freshRows);

  if (rows.length > 0) {
    const entry: PriceCacheEntry = {
      rows,
      savedAt: Date.now(),
      itemIdForPrice,
      quality,
    };
    store.set(key, entry);
    saveToDisk();
    return { rows, hasStaleRows, savedAt: entry.savedAt };
  }

  return {
    rows: cached?.rows ?? [],
    hasStaleRows: (cached?.rows.length ?? 0) > 0,
    savedAt: cached?.savedAt ?? null,
  };
}

export function getCachedPricesOnly(key: string): {
  rows: PriceRowDto[];
  savedAt: number | null;
} {
  const cached = store.get(key);
  if (!cached) {
    return { rows: [], savedAt: null };
  }
  return {
    rows: cached.rows.map((row) => ({ ...row, stale: true })),
    savedAt: cached.savedAt,
  };
}

export function getAllPriceCacheEntries(): PriceCacheEntry[] {
  return [...store.values()];
}

export { buildPriceCacheKey };
