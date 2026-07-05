import {
  blackMarketRowFromPriceFetch,
  blackMarketRowsFromPriceCache,
} from "@/lib/black-market-from-cache";
import {
  readBlackMarketSnapshot,
  writeBlackMarketSnapshot,
  type BlackMarketRow,
  type BlackMarketSnapshot,
} from "@/lib/black-market-store";
import {
  ensureItemsReady,
  getAllCatalogItems,
  getItemByNumericId,
  getItemCapabilities,
  lookupItemByPriceId,
  resolvePriceItemId,
  searchItems,
} from "@/lib/items";
import type { PriceRowDto } from "@/lib/price-cache";

const ALBION_PRICES_BASE =
  "https://europe.albion-online-data.com/api/v2/stats/prices";
const BLACK_MARKET_LOCATION = "Black Market";
const BATCH_DELAY_MS = 60;
const PARALLEL_BATCHES = 3;
const CACHE_TTL_MS = 30 * 60 * 1000;
const MIN_TIER = 4;
const MAX_TIER = 8;
const MAX_URL_LENGTH = 3800;
const SEARCH_FETCH_LIMIT = 24;

type AlbionPriceRow = {
  item_id: string;
  city: string;
  quality: number;
  buy_price_max: number;
  buy_price_max_date: string;
};

type AlbionPriceRowAllCities = {
  city: string;
  quality: number;
  buy_price_max: number;
  buy_price_max_date: string;
  sell_price_min: number;
  sell_price_min_date: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isInvalidDate(iso: string): boolean {
  return !iso || iso.startsWith("0001-01-01");
}

function formatUpdatedAt(iso: string): {
  label: string;
  epoch: number | null;
} {
  if (isInvalidDate(iso)) return { label: "—", epoch: null };
  const epoch = new Date(iso).getTime();
  if (!Number.isFinite(epoch)) return { label: "—", epoch: null };
  return {
    label: new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(epoch),
    epoch,
  };
}

function rowKey(row: BlackMarketRow): string {
  return `${row.priceItemId}@${row.quality}`;
}

function sortRows(rows: BlackMarketRow[]): BlackMarketRow[] {
  return [...rows].sort((a, b) => {
    if (b.buyPriceMax !== a.buyPriceMax) return b.buyPriceMax - a.buyPriceMax;
    const aName = (a.ruName || a.name).toLowerCase();
    const bName = (b.ruName || b.name).toLowerCase();
    return aName.localeCompare(bName);
  });
}

function mergeRows(
  existing: BlackMarketRow[],
  incoming: BlackMarketRow[],
): BlackMarketRow[] {
  const map = new Map<string, BlackMarketRow>();
  for (const row of existing) map.set(rowKey(row), row);
  for (const row of incoming) map.set(rowKey(row), row);
  return sortRows([...map.values()]);
}

function collectPriceItemIds(): string[] {
  const entries: Array<{ id: string; tier: number; enchant: number }> = [];

  for (const item of getAllCatalogItems()) {
    if (item.tier == null || item.tier < MIN_TIER || item.tier > MAX_TIER) {
      continue;
    }
    const capabilities = getItemCapabilities(item);
    const enchants =
      capabilities.enchants.length > 0 ? capabilities.enchants : [0];
    for (const enchant of enchants) {
      entries.push({
        id: resolvePriceItemId(item, enchant),
        tier: item.tier,
        enchant,
      });
    }
  }

  entries.sort((a, b) => {
    if (b.tier !== a.tier) return b.tier - a.tier;
    return b.enchant - a.enchant;
  });

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    ids.push(entry.id);
  }
  return ids;
}

function chunkByUrlLength(itemIds: string[]): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentLen = 0;
  const baseLen =
    `${ALBION_PRICES_BASE}/.json?locations=${encodeURIComponent(BLACK_MARKET_LOCATION)}&qualities=1,2,3,4,5`.length;

  for (const id of itemIds) {
    const part = (current.length > 0 ? "," : "") + encodeURIComponent(id);
    if (
      current.length > 0 &&
      baseLen + currentLen + part.length > MAX_URL_LENGTH
    ) {
      batches.push(current);
      current = [id];
      currentLen = encodeURIComponent(id).length;
    } else {
      current.push(id);
      currentLen += part.length;
    }
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

async function fetchBlackMarketBatch(
  itemIds: string[],
  retries = 2,
): Promise<AlbionPriceRow[]> {
  const path = itemIds.map(encodeURIComponent).join(",");
  const url = `${ALBION_PRICES_BASE}/${path}.json?locations=${encodeURIComponent(BLACK_MARKET_LOCATION)}&qualities=1,2,3,4,5`;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 429) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (!res.ok) return [];
      const raw = (await res.json()) as AlbionPriceRow[];
      return Array.isArray(raw) ? raw : [];
    } catch {
      if (attempt < retries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      return [];
    }
  }
  return [];
}

async function fetchItemPricesAllCities(
  priceItemId: string,
): Promise<AlbionPriceRowAllCities[]> {
  const url = `${ALBION_PRICES_BASE}/${encodeURIComponent(priceItemId)}.json?qualities=1,2,3,4,5`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const raw = (await res.json()) as AlbionPriceRowAllCities[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function mapPriceRows(raw: AlbionPriceRow[]): BlackMarketRow[] {
  const rows: BlackMarketRow[] = [];
  for (const entry of raw) {
    if (entry.city !== BLACK_MARKET_LOCATION) continue;
    if (!Number.isFinite(entry.buy_price_max) || entry.buy_price_max <= 0) {
      continue;
    }
    const resolved = lookupItemByPriceId(entry.item_id);
    if (!resolved) continue;

    const { item, enchant } = resolved;
    const capabilities = getItemCapabilities(item);
    const { label, epoch } = formatUpdatedAt(entry.buy_price_max_date);

    rows.push({
      itemId: item.id,
      priceItemId: entry.item_id,
      uniqueName: item.uniqueName,
      baseUniqueName: item.baseUniqueName,
      name: item.name,
      ruName: item.ruName,
      baseName: item.baseName,
      tier: item.tier,
      enchant,
      quality: entry.quality,
      buyPriceMax: entry.buy_price_max,
      updatedAt: label,
      updatedAtEpoch: epoch,
      enchantStyle: capabilities.enchantStyle,
    });
  }
  return rows;
}

function mapAllCitiesToBmRows(
  priceItemId: string,
  raw: AlbionPriceRowAllCities[],
): BlackMarketRow[] {
  const resolved = lookupItemByPriceId(priceItemId);
  if (!resolved) return [];

  const { item, enchant } = resolved;
  const capabilities = getItemCapabilities(item);
  const rows: BlackMarketRow[] = [];

  for (const entry of raw) {
    if (entry.city !== BLACK_MARKET_LOCATION) continue;
    if (!Number.isFinite(entry.buy_price_max) || entry.buy_price_max <= 0) {
      continue;
    }
    const { label, epoch } = formatUpdatedAt(entry.buy_price_max_date);
    rows.push({
      itemId: item.id,
      priceItemId,
      uniqueName: item.uniqueName,
      baseUniqueName: item.baseUniqueName,
      name: item.name,
      ruName: item.ruName,
      baseName: item.baseName,
      tier: item.tier,
      enchant,
      quality: entry.quality,
      buyPriceMax: entry.buy_price_max,
      updatedAt: label,
      updatedAtEpoch: epoch,
      enchantStyle: capabilities.enchantStyle,
    });
  }
  return rows;
}

function snapshotWithMergedCache(
  snapshot: BlackMarketSnapshot,
): BlackMarketSnapshot {
  const merged = mergeRows(snapshot.rows, blackMarketRowsFromPriceCache());
  if (merged.length === snapshot.rows.length) return snapshot;
  return {
    ...snapshot,
    rows: merged,
    cachedAt: snapshot.cachedAt ?? Date.now(),
  };
}

export function indexBlackMarketFromPriceFetch(
  itemId: number,
  priceItemId: string,
  quality: number,
  priceRows: PriceRowDto[],
): void {
  const row = blackMarketRowFromPriceFetch(
    itemId,
    priceItemId,
    quality,
    priceRows,
  );
  if (!row) return;

  const snapshot = readBlackMarketSnapshot();
  writeBlackMarketSnapshot({
    ...snapshot,
    rows: mergeRows(snapshot.rows, [row]),
    cachedAt: Date.now(),
    scanning: false,
    scanProgress: null,
    scanError: null,
  });
}

export async function scanBlackMarketStep(): Promise<BlackMarketSnapshot> {
  await ensureItemsReady();
  const batches = chunkByUrlLength(collectPriceItemIds());
  const snapshot = snapshotWithMergedCache(readBlackMarketSnapshot());

  const done = snapshot.scanProgress?.done ?? 0;
  if (!snapshot.scanning || done >= batches.length) {
    const finished: BlackMarketSnapshot = {
      ...snapshot,
      scanning: false,
      scanProgress: null,
      scanError: null,
      cachedAt: snapshot.cachedAt ?? Date.now(),
    };
    writeBlackMarketSnapshot(finished);
    return finished;
  }

  const batchRows = await Promise.all(
    batches
      .slice(done, done + Math.min(PARALLEL_BATCHES, batches.length - done))
      .map((batch) => fetchBlackMarketBatch(batch)),
  );
  const merged = mergeRows(snapshot.rows, mapPriceRows(batchRows.flat()));
  const nextDone =
    done + Math.min(PARALLEL_BATCHES, batches.length - done);
  const finished = nextDone >= batches.length;

  const next: BlackMarketSnapshot = {
    rows: merged,
    cachedAt: finished ? Date.now() : snapshot.cachedAt,
    scanning: !finished,
    scanProgress: finished ? null : { done: nextDone, total: batches.length },
    scanError: null,
  };
  writeBlackMarketSnapshot(next);
  if (!finished) await sleep(BATCH_DELAY_MS);

  return next;
}

export function beginBlackMarketScan(): BlackMarketSnapshot {
  const snapshot = snapshotWithMergedCache(readBlackMarketSnapshot());
  const batches = chunkByUrlLength(collectPriceItemIds());
  const next: BlackMarketSnapshot = {
    rows: snapshot.rows,
    cachedAt: snapshot.cachedAt,
    scanning: true,
    scanProgress: { done: 0, total: batches.length },
    scanError: null,
  };
  writeBlackMarketSnapshot(next);
  return next;
}

export async function fetchBlackMarketForSearch(
  query: string,
): Promise<BlackMarketRow[]> {
  await ensureItemsReady();
  const hits = searchItems(query).slice(0, SEARCH_FETCH_LIMIT);
  const rows: BlackMarketRow[] = [];

  for (let i = 0; i < hits.length; i += 6) {
    const group = hits.slice(i, i + 6);
    const groupRows = await Promise.all(
      group.map(async (hit) => {
        const item = getItemByNumericId(hit.id);
        if (!item) return [] as BlackMarketRow[];
        const priceItemId = resolvePriceItemId(item, hit.listEnchant);
        const raw = await fetchItemPricesAllCities(priceItemId);
        return mapAllCitiesToBmRows(priceItemId, raw);
      }),
    );
    rows.push(...groupRows.flat());
  }

  return rows;
}

export function isBlackMarketCacheStale(cachedAt: number | null): boolean {
  if (!cachedAt) return true;
  return Date.now() - cachedAt > CACHE_TTL_MS;
}

export async function getBlackMarketData(options?: {
  step?: boolean;
  stepCount?: number;
  beginScan?: boolean;
  query?: string;
}): Promise<BlackMarketSnapshot & { stale: boolean }> {
  await ensureItemsReady();

  if (options?.beginScan) {
    const started = beginBlackMarketScan();
    return { ...started, stale: false };
  }

  if (options?.step) {
    const count = Math.min(Math.max(options.stepCount ?? 1, 1), 6);
    let snapshot = snapshotWithMergedCache(readBlackMarketSnapshot());
    for (let i = 0; i < count && snapshot.scanning; i += 1) {
      snapshot = await scanBlackMarketStep();
    }
    return { ...snapshot, stale: isBlackMarketCacheStale(snapshot.cachedAt) };
  }

  let snapshot = snapshotWithMergedCache(readBlackMarketSnapshot());
  const merged = mergeRows(snapshot.rows, blackMarketRowsFromPriceCache());
  if (merged.length !== snapshot.rows.length) {
    snapshot = {
      ...snapshot,
      rows: merged,
      cachedAt: snapshot.cachedAt ?? Date.now(),
    };
    writeBlackMarketSnapshot(snapshot);
  }

  if (options?.query && options.query.trim().length >= 2) {
    const fetched = await fetchBlackMarketForSearch(options.query);
    snapshot = {
      ...snapshot,
      rows: mergeRows(snapshot.rows, fetched),
      cachedAt: Date.now(),
      scanning: false,
      scanProgress: null,
      scanError: null,
    };
    writeBlackMarketSnapshot(snapshot);
  }

  return {
    ...snapshot,
    stale: isBlackMarketCacheStale(snapshot.cachedAt),
  };
}
