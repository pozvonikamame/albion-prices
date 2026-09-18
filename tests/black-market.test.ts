import { beforeEach, describe, expect, it, vi } from "vitest";

type ScanSnapshot = {
  rows: Array<Record<string, unknown>>;
  cachedAt: number | null;
  scanning: boolean;
  scanProgress: { done: number; total: number } | null;
  scanError: string | null;
};

type CatalogItem = {
  id: number;
  uniqueName: string;
  baseUniqueName: string;
  name: string;
  ruName: string;
  baseName: string;
  tier: number;
  priceId: string;
};

const mocks = vi.hoisted(() => ({
  snapshot: {
    rows: [],
    cachedAt: null,
    scanning: false,
    scanProgress: null,
    scanError: null,
  } as ScanSnapshot,
  items: [] as CatalogItem[],
}));

vi.mock("@/lib/black-market-store", () => ({
  readBlackMarketSnapshot: () => mocks.snapshot,
  writeBlackMarketSnapshot: (snapshot: unknown) => {
    mocks.snapshot = snapshot as ScanSnapshot;
  },
}));

vi.mock("@/lib/black-market-from-cache", () => ({
  blackMarketRowFromPriceFetch: () => null,
  blackMarketRowsFromPriceCache: () => [],
}));

vi.mock("@/lib/items", () => ({
  ensureItemsReady: async () => {},
  getAllCatalogItems: () => mocks.items,
  getItemCapabilities: () => ({ enchants: [0], enchantStyle: "none" }),
  resolvePriceItemId: (item: CatalogItem) => item.priceId,
  lookupItemByPriceId: (id: string) => {
    const item = mocks.items.find((entry) => entry.priceId === id);
    return item ? { item, enchant: 0 } : null;
  },
  getItemByNumericId: () => null,
  searchItems: () => [],
}));

import { getBlackMarketData } from "@/lib/black-market";

function makeItems(count: number): CatalogItem[] {
  return Array.from({ length: count }, (_, i) => {
    const priceId = `T4_ITEM_${String(i).padStart(5, "0")}`;
    return {
      id: i + 1,
      uniqueName: priceId,
      baseUniqueName: priceId,
      name: priceId,
      ruName: priceId,
      baseName: priceId,
      tier: 4,
      priceId,
    };
  });
}

function installFetchMock() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const file = url.pathname.split("/").pop() ?? "";
      const ids = file
        .replace(/\.json$/, "")
        .split(",")
        .filter(Boolean)
        .map((part) => decodeURIComponent(part));
      const body = ids.map((item_id) => ({
        item_id,
        city: "Black Market",
        quality: 1,
        buy_price_max: 100,
        buy_price_max_date: "2026-01-01T00:00:00.000Z",
      }));
      return {
        ok: true,
        status: 200,
        json: async () => body,
      } as Response;
    }),
  );
}

beforeEach(() => {
  mocks.snapshot = {
    rows: [],
    cachedAt: null,
    scanning: false,
    scanProgress: null,
    scanError: null,
  };
  mocks.items = [];
  installFetchMock();
});

describe("black market scan persistence", () => {
  it("persists rows from every step so a multi-request scan is not truncated (F-1)", async () => {
    mocks.items = makeItems(1200);

    const first = await getBlackMarketData({
      step: true,
      stepCount: 1,
      scanDone: 0,
    });
    const total = first.scanProgress?.total ?? 0;
    expect(total).toBeGreaterThan(3);
    expect(first.scanning).toBe(true);

    let done = first.scanProgress?.done ?? 0;
    let last = first;
    while (last.scanning) {
      last = await getBlackMarketData({
        step: true,
        stepCount: 3,
        scanDone: done,
      });
      done = last.scanProgress?.done ?? done;
    }

    expect(last.scanning).toBe(false);
    // Every item id produced exactly one row; the persisted cache must hold all of them.
    expect(mocks.snapshot.rows.length).toBe(mocks.items.length);
  });

  it("does not renew the cache TTL when done is at/over total (F-2)", async () => {
    const past = Date.now() - 60 * 60 * 1000;
    mocks.snapshot = {
      rows: [{ priceItemId: "T4_X", quality: 1 }],
      cachedAt: past,
      scanning: false,
      scanProgress: null,
      scanError: null,
    };

    const res = await getBlackMarketData({
      step: true,
      stepCount: 1,
      scanDone: 10_000_000,
    });

    expect(res.scanning).toBe(false);
    expect(res.stale).toBe(true);
    expect(mocks.snapshot.cachedAt).toBe(past);
  });
});
