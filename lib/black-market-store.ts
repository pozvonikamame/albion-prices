import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { EnchantStyle } from "@/lib/item-icon";

export type BlackMarketRow = {
  itemId: number;
  priceItemId: string;
  uniqueName: string;
  baseUniqueName: string;
  name: string;
  ruName: string;
  baseName: string;
  tier: number | null;
  enchant: number;
  quality: number;
  buyPriceMax: number;
  updatedAt: string;
  updatedAtEpoch: number | null;
  enchantStyle: EnchantStyle;
};

export type BlackMarketSnapshot = {
  rows: BlackMarketRow[];
  cachedAt: number | null;
  scanning: boolean;
  scanProgress: { done: number; total: number } | null;
  scanError: string | null;
};

const CACHE_DIR = process.env.VERCEL
  ? join("/tmp", "albion-prices-cache")
  : join(process.cwd(), ".cache");
const CACHE_FILE = join(CACHE_DIR, "black-market.json");

const EMPTY_SNAPSHOT: BlackMarketSnapshot = {
  rows: [],
  cachedAt: null,
  scanning: false,
  scanProgress: null,
  scanError: null,
};

type BlackMarketGlobal = typeof globalThis & {
  __blackMarketSnapshot?: BlackMarketSnapshot;
};

function normalizeSnapshot(
  parsed: Partial<BlackMarketSnapshot> | null | undefined,
): BlackMarketSnapshot | null {
  if (!parsed || !Array.isArray(parsed.rows)) return null;
  return {
    rows: parsed.rows,
    cachedAt: typeof parsed.cachedAt === "number" ? parsed.cachedAt : null,
    scanning: Boolean(parsed.scanning),
    scanProgress:
      parsed.scanProgress &&
      typeof parsed.scanProgress.done === "number" &&
      typeof parsed.scanProgress.total === "number"
        ? parsed.scanProgress
        : null,
    scanError: typeof parsed.scanError === "string" ? parsed.scanError : null,
  };
}

function readSnapshotFromDisk(): BlackMarketSnapshot | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const parsed = JSON.parse(
      readFileSync(CACHE_FILE, "utf8"),
    ) as BlackMarketSnapshot;
    return normalizeSnapshot(parsed);
  } catch {
    return null;
  }
}

export function readBlackMarketSnapshot(): BlackMarketSnapshot {
  const globalSnapshot = normalizeSnapshot(
    (globalThis as BlackMarketGlobal).__blackMarketSnapshot,
  );
  if (globalSnapshot) return globalSnapshot;

  const diskSnapshot = readSnapshotFromDisk();
  if (diskSnapshot) {
    (globalThis as BlackMarketGlobal).__blackMarketSnapshot = diskSnapshot;
    return diskSnapshot;
  }

  return EMPTY_SNAPSHOT;
}

export function writeBlackMarketSnapshot(snapshot: BlackMarketSnapshot): void {
  (globalThis as BlackMarketGlobal).__blackMarketSnapshot = snapshot;
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(snapshot), "utf8");
  } catch {
    // Ignore on read-only filesystems.
  }
}
