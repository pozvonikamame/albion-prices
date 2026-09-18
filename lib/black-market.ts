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
const CACHE_TTL_MS = 30 * 60 * 1000;
const MIN_TIER = 4;
const MAX_TIER = 8;
const MAX_URL_LENGTH = 3800;
const SEARCH_FETCH_LIMIT = 24;
const STEP_BUDGET_MS = 45_000;

export type ScanProfile = "turbo" | "normal" | "background";

const SCAN_PROFILES: Record<
  ScanProfile,
  { parallel: number; delayMs: number; maxWaves: number }
> = {
  turbo: { parallel: 4, delayMs: 20, maxWaves: 6 },
  normal: { parallel: 3, delayMs: 60, maxWaves: 6 },
  background: { parallel: 3, delayMs: 80, maxWaves: 2 },
};

export type BlackMarketScanFilter = {
  tiers?: number[];
  enchants?: number[];
  quality?: number;
  suffixes?: string[];
};

function itemSuffix(baseUniqueName: string): string | null {
  const match = /^T\d+_(.+)$/.exec(baseUniqueName);
  return match ? match[1] : null;
}

function qualitiesParam(quality?: number): string {
  if (quality != null && quality >= 1 && quality <= 5) {
    return String(quality);
  }
  return "1,2,3,4,5";
}

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

function orderPriceItemIds(
  entries: Array<{ id: string; tier: number; enchant: number }>,
): string[] {
  const byTier = new Map<number, Array<{ id: string; enchant: number }>>();

  for (const entry of entries) {
    if (!byTier.has(entry.tier)) byTier.set(entry.tier, []);
    const tierList = byTier.get(entry.tier)!;
    if (tierList.some((item) => item.id === entry.id)) continue;
    tierList.push({ id: entry.id, enchant: entry.enchant });
  }

  for (const tierList of byTier.values()) {
    tierList.sort((a, b) => b.enchant - a.enchant);
  }

  const tiers = [8, 7, 6, 5, 4].filter((tier) => byTier.has(tier));
  const indices = new Map(tiers.map((tier) => [tier, 0]));
  const ids: string[] = [];

  while (true) {
    let progressed = false;
    for (const tier of tiers) {
      const tierList = byTier.get(tier)!;
      const index = indices.get(tier) ?? 0;
      if (index >= tierList.length) continue;
      ids.push(tierList[index].id);
      indices.set(tier, index + 1);
      progressed = true;
    }
    if (!progressed) break;
  }

  return ids;
}

function collectPriceItemIds(filter?: BlackMarketScanFilter): string[] {
  const tierSet =
    filter?.tiers && filter.tiers.length > 0
      ? new Set(filter.tiers)
      : null;
  const suffixSet =
    filter?.suffixes && filter.suffixes.length > 0
      ? new Set(filter.suffixes)
      : null;
  const enchantSet =
    filter?.enchants && filter.enchants.length > 0
      ? new Set(filter.enchants)
      : null;
  const entries: Array<{ id: string; tier: number; enchant: number }> = [];

  for (const item of getAllCatalogItems()) {
    if (item.tier == null || item.tier < MIN_TIER || item.tier > MAX_TIER) {
      continue;
    }
    if (tierSet && !tierSet.has(item.tier)) continue;

    const suffix = itemSuffix(item.baseUniqueName);
    if (suffixSet && (!suffix || !suffixSet.has(suffix))) continue;

    const capabilities = getItemCapabilities(item);
    let enchants =
      capabilities.enchants.length > 0 ? capabilities.enchants : [0];
    if (enchantSet) {
      enchants = enchants.filter((level) => enchantSet.has(level));
      if (enchants.length === 0) continue;
    }

    for (const enchant of enchants) {
      entries.push({
        id: resolvePriceItemId(item, enchant),
        tier: item.tier,
        enchant,
      });
    }
  }

  return orderPriceItemIds(entries);
}

function chunkByUrlLength(
  itemIds: string[],
  quality?: number,
): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentLen = 0;
  const qualities = qualitiesParam(quality);
  const baseLen =
    `${ALBION_PRICES_BASE}/.json?locations=${encodeURIComponent(BLACK_MARKET_LOCATION)}&qualities=${qualities}`.length;

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
  options?: { quality?: number; retries?: number; deadline?: number },
): Promise<AlbionPriceRow[]> {
  const retries = options?.retries ?? 2;
  const qualities = qualitiesParam(options?.quality);
  const deadline = options?.deadline ?? Date.now() + STEP_BUDGET_MS;
  const path = itemIds.map(encodeURIComponent).join(",");
  const url = `${ALBION_PRICES_BASE}/${path}.json?locations=${encodeURIComponent(BLACK_MARKET_LOCATION)}&qualities=${qualities}`;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return [];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (res.status === 429) {
        const wait = 2000 * (attempt + 1);
        if (Date.now() + wait >= deadline) return [];
        await sleep(wait);
        continue;
      }
      if (!res.ok) return [];
      const raw = (await res.json()) as AlbionPriceRow[];
      return Array.isArray(raw) ? raw : [];
    } catch {
      const wait = 1000 * (attempt + 1);
      if (attempt < retries && Date.now() + wait < deadline) {
        await sleep(wait);
        continue;
      }
      return [];
    } finally {
      clearTimeout(timer);
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

export function beginBlackMarketScan(options?: {
  clearRows?: boolean;
  filter?: BlackMarketScanFilter;
}): BlackMarketSnapshot & { filtered?: boolean } {
  const snapshot = snapshotWithMergedCache(readBlackMarketSnapshot());
  const total = chunkByUrlLength(
    collectPriceItemIds(options?.filter),
    options?.filter?.quality,
  ).length;

  if (options?.clearRows) {
    return {
      rows: [],
      cachedAt: null,
      scanning: total > 0,
      scanProgress: total > 0 ? { done: 0, total } : null,
      scanError: total > 0 ? null : "No items match the current filters",
      filtered: Boolean(options?.filter),
    };
  }

  const progress = snapshot.scanProgress;
  const scanIncomplete =
    Boolean(snapshot.scanning) &&
    progress != null &&
    progress.done < progress.total &&
    progress.total === total;

  const staleComplete =
    !options?.filter &&
    !scanIncomplete &&
    isBlackMarketCacheStale(snapshot.cachedAt);

  const resumeDone =
    !options?.filter && scanIncomplete && !staleComplete ? progress!.done : 0;

  if (!options?.filter && (scanIncomplete || resumeDone > 0 || staleComplete)) {
    writeBlackMarketSnapshot({
      ...snapshot,
      scanning: total > 0,
      scanProgress: total > 0 ? { done: resumeDone, total } : null,
      scanError: null,
    });
  }

  return {
    rows: snapshot.rows,
    cachedAt: snapshot.cachedAt,
    scanning: total > 0,
    scanProgress: total > 0 ? { done: resumeDone, total } : null,
    scanError: total > 0 ? null : "No items match the current filters",
    filtered: Boolean(options?.filter),
  };
}

export async function scanBlackMarketFromDone(
  startDone: number,
  waveCount: number,
  filter?: BlackMarketScanFilter,
  profile: ScanProfile = "normal",
): Promise<{
  addedRows: BlackMarketRow[];
  scanning: boolean;
  scanProgress: { done: number; total: number };
  ran: boolean;
}> {
  await ensureItemsReady();
  const { parallel, delayMs, maxWaves } = SCAN_PROFILES[profile];
  const batches = chunkByUrlLength(
    collectPriceItemIds(filter),
    filter?.quality,
  );
  const total = batches.length;
  let done = Math.min(Math.max(startDone, 0), total);
  const addedRows: BlackMarketRow[] = [];
  const waves = Math.min(Math.max(waveCount, 1), maxWaves);
  const deadline = Date.now() + STEP_BUDGET_MS;
  let ran = false;

  for (let wave = 0; wave < waves && done < total; wave += 1) {
    if (Date.now() >= deadline) break;
    const end = Math.min(done + parallel, total);
    const batchSlice = batches.slice(done, end);
    const batchRows = await Promise.all(
      batchSlice.map((batch) =>
        fetchBlackMarketBatch(batch, {
          quality: filter?.quality,
          deadline,
        }),
      ),
    );
    addedRows.push(...mapPriceRows(batchRows.flat()));
    done = end;
    ran = true;
    if (done < total && wave < waves - 1 && Date.now() < deadline) {
      await sleep(delayMs);
    }
  }

  return {
    addedRows,
    scanning: done < total,
    scanProgress: { done, total },
    ran,
  };
}

function persistScanProgress(
  snapshot: BlackMarketSnapshot,
  result: {
    addedRows: BlackMarketRow[];
    scanning: boolean;
    scanProgress: { done: number; total: number };
    ran: boolean;
  },
): BlackMarketSnapshot {
  const merged = mergeRows(snapshot.rows, result.addedRows);
  const finished = !result.scanning;
  return {
    rows: merged,
    cachedAt: finished
      ? result.ran
        ? Date.now()
        : snapshot.cachedAt
      : (snapshot.cachedAt ?? Date.now()),
    scanning: result.scanning,
    scanProgress: result.scanning ? result.scanProgress : null,
    scanError: null,
  };
}

export async function runBlackMarketScanBurst(options?: {
  timeBudgetMs?: number;
  filter?: BlackMarketScanFilter;
}): Promise<{
  rowCount: number;
  scanning: boolean;
  scanProgress: { done: number; total: number } | null;
  addedRows: number;
}> {
  await ensureItemsReady();
  const isFiltered = Boolean(options?.filter);
  const deadline = Date.now() + (options?.timeBudgetMs ?? 55_000);
  let snapshot = isFiltered
    ? {
        rows: [],
        cachedAt: null,
        scanning: false,
        scanProgress: null,
        scanError: null,
      }
    : snapshotWithMergedCache(readBlackMarketSnapshot());

  const total = chunkByUrlLength(
    collectPriceItemIds(options?.filter),
    options?.filter?.quality,
  ).length;

  let done = snapshot.scanProgress?.done ?? 0;
  const scanIncomplete =
    snapshot.scanProgress != null && snapshot.scanProgress.done < total;

  if (
    !isFiltered &&
    isBlackMarketCacheStale(snapshot.cachedAt) &&
    !scanIncomplete
  ) {
    done = 0;
    snapshot = {
      ...snapshot,
      scanning: true,
      scanProgress: { done: 0, total },
      scanError: null,
    };
    writeBlackMarketSnapshot(snapshot);
  }

  let addedTotal = 0;

  while (Date.now() < deadline && done < total) {
    const result = await scanBlackMarketFromDone(
      done,
      6,
      options?.filter,
      "turbo",
    );
    done = result.scanProgress.done;
    addedTotal += result.addedRows.length;

    if (!isFiltered) {
      snapshot = persistScanProgress(snapshot, result);
      writeBlackMarketSnapshot(snapshot);
    }

    if (!result.scanning) break;
  }

  return {
    rowCount: snapshot.rows.length,
    scanning: done < total,
    scanProgress: done < total ? { done, total } : null,
    addedRows: addedTotal,
  };
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

export async function getBlackMarketMeta(): Promise<{
  stale: boolean;
  cachedAt: number | null;
  scanning: boolean;
  scanProgress: BlackMarketSnapshot["scanProgress"];
  rowCount: number;
}> {
  await ensureItemsReady();
  const snapshot = snapshotWithMergedCache(readBlackMarketSnapshot());
  const scanIncomplete =
    Boolean(snapshot.scanning) ||
    (snapshot.scanProgress != null &&
      snapshot.scanProgress.done < snapshot.scanProgress.total);
  return {
    stale: isBlackMarketCacheStale(snapshot.cachedAt) && !scanIncomplete,
    cachedAt: snapshot.cachedAt,
    scanning: scanIncomplete,
    scanProgress: snapshot.scanProgress,
    rowCount: snapshot.rows.length,
  };
}

export async function getBlackMarketData(options?: {
  step?: boolean;
  stepCount?: number;
  scanDone?: number;
  beginScan?: boolean;
  clearRows?: boolean;
  query?: string;
  filter?: BlackMarketScanFilter;
  profile?: ScanProfile;
}): Promise<
  BlackMarketSnapshot & {
    stale: boolean;
    incremental?: boolean;
    filtered?: boolean;
  }
> {
  await ensureItemsReady();
  const isFiltered = Boolean(options?.filter);

  if (options?.beginScan) {
    const started = beginBlackMarketScan({
      clearRows: Boolean(options.clearRows),
      filter: options.filter,
    });
    return { ...started, stale: false };
  }

  if (options?.step) {
    const count = Math.min(Math.max(options.stepCount ?? 1, 1), 6);
    const profile = options.profile ?? "normal";
    const startDone = Math.max(options.scanDone ?? 0, 0);
    const result = await scanBlackMarketFromDone(
      startDone,
      count,
      options.filter,
      profile,
    );
    const snapshot = isFiltered
      ? {
          rows: [],
          cachedAt: null,
          scanning: false,
          scanProgress: null,
          scanError: null,
        }
      : snapshotWithMergedCache(readBlackMarketSnapshot());
    const finished = !result.scanning;
    const nextSnapshot = isFiltered
      ? snapshot
      : persistScanProgress(snapshot, result);

    if (!isFiltered) {
      writeBlackMarketSnapshot(nextSnapshot);
    }

    return {
      rows: result.addedRows,
      incremental: true,
      filtered: isFiltered,
      cachedAt: nextSnapshot.cachedAt,
      scanning: result.scanning,
      scanProgress: result.scanning ? result.scanProgress : null,
      scanError: null,
      stale:
        finished && (isFiltered || result.ran)
          ? false
          : isBlackMarketCacheStale(nextSnapshot.cachedAt),
    };
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
    stale:
      isBlackMarketCacheStale(snapshot.cachedAt) &&
      !(
        snapshot.scanning ||
        (snapshot.scanProgress != null &&
          snapshot.scanProgress.done < snapshot.scanProgress.total)
      ),
  };
}

export function parseBlackMarketScanFilter(
  params: URLSearchParams,
): BlackMarketScanFilter | undefined {
  const filter: BlackMarketScanFilter = {};
  let hasFilter = false;

  const tier = params.get("tier");
  if (tier) {
    filter.tiers = tier
      .split(",")
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => value >= MIN_TIER && value <= MAX_TIER);
    if (filter.tiers.length > 0) hasFilter = true;
  }

  const enchant = params.get("enchant");
  if (enchant != null && enchant !== "") {
    filter.enchants = enchant
      .split(",")
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => value >= 0 && value <= 4);
    if (filter.enchants.length > 0) hasFilter = true;
  }

  const quality = params.get("quality");
  if (quality) {
    const parsed = Number.parseInt(quality, 10);
    if (parsed >= 1 && parsed <= 5) {
      filter.quality = parsed;
      hasFilter = true;
    }
  }

  const gear = params.get("gear");
  if (gear) {
    filter.suffixes = gear.split(",").filter(Boolean);
    if (filter.suffixes.length > 0) hasFilter = true;
  }

  return hasFilter ? filter : undefined;
}

export function parseScanProfile(params: URLSearchParams): ScanProfile {
  if (params.get("turbo") === "1") return "turbo";
  if (params.get("background") === "1") return "background";
  return "normal";
}
