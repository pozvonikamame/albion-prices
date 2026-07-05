import type { PriceRowDto } from "@/lib/price-cache";

const STORAGE_KEY = "albion-price-cache-v1";
const MAX_ENTRIES = 120;

type ClientPriceCacheStore = Record<
  string,
  {
    rows: PriceRowDto[];
    savedAt: number;
  }
>;

function readStore(): ClientPriceCacheStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ClientPriceCacheStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: ClientPriceCacheStore): void {
  if (typeof window === "undefined") return;
  try {
    const entries = Object.entries(store).sort(([, a], [, b]) => b.savedAt - a.savedAt);
    const trimmed = Object.fromEntries(entries.slice(0, MAX_ENTRIES));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota or private mode — ignore.
  }
}

export function buildClientPriceCacheKey(
  itemId: number,
  enchant: number,
  quality: number,
): string {
  return `${itemId}:e${enchant}:q${quality}`;
}

export function readClientPriceCache(key: string): {
  rows: PriceRowDto[];
  savedAt: number;
} | null {
  const entry = readStore()[key];
  if (!entry?.rows?.length) return null;
  return entry;
}

export function writeClientPriceCache(key: string, rows: PriceRowDto[]): void {
  if (!rows.length) return;
  const store = readStore();
  store[key] = { rows, savedAt: Date.now() };
  writeStore(store);
}
