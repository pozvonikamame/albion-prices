import { indexBlackMarketFromPriceFetch } from "@/lib/black-market";
import { ensureItemsReady, getItemByNumericId, getItemMaxEnchantLevel, resolvePriceItemId } from "@/lib/items";
import {
  buildPriceCacheKey,
  type PriceRowDto,
} from "@/lib/price-cache";
import {
  getCachedPricesOnly,
  resolvePricesWithCache,
} from "@/lib/price-cache-store";
import { NextRequest } from "next/server";

const ALBION_PRICES_BASE =
  "https://europe.albion-online-data.com/api/v2/stats/prices";

type AlbionPriceRow = {
  city: string;
  sell_price_min: number;
  sell_price_min_date: string;
  buy_price_max: number;
  buy_price_max_date: string;
};

function isInvalidDate(iso: string): boolean {
  return !iso || iso.startsWith("0001-01-01");
}

function latestUpdate(sellDate: string, buyDate: string): {
  label: string;
  epoch: number | null;
} {
  const times: number[] = [];
  if (!isInvalidDate(sellDate)) times.push(new Date(sellDate).getTime());
  if (!isInvalidDate(buyDate)) times.push(new Date(buyDate).getTime());
  if (times.length === 0) {
    return { label: "—", epoch: null };
  }
  const epoch = Math.max(...times);
  const latest = new Date(epoch);
  return {
    label: new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(latest),
    epoch,
  };
}

function mapAlbionRows(raw: AlbionPriceRow[]): PriceRowDto[] {
  return raw.map((row) => {
    const { label, epoch } = latestUpdate(
      row.sell_price_min_date,
      row.buy_price_max_date,
    );
    return {
      city: row.city,
      sellPriceMin: row.sell_price_min,
      buyPriceMax: row.buy_price_max,
      updatedAt: label,
      updatedAtEpoch: epoch,
    };
  });
}

export async function GET(req: NextRequest) {
  try {
    await ensureItemsReady();
  } catch {
    return Response.json({ error: "Items database unavailable" }, { status: 503 });
  }

  const idParam = req.nextUrl.searchParams.get("id");
  const enchantParam = req.nextUrl.searchParams.get("enchant") ?? "0";
  const qualityParam = req.nextUrl.searchParams.get("quality") ?? "1";
  if (!idParam) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }
  const id = Number.parseInt(idParam, 10);
  const enchant = Number.parseInt(enchantParam, 10);
  const quality = Number.parseInt(qualityParam, 10);
  if (!Number.isFinite(id)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  if (!Number.isFinite(enchant) || enchant < 0 || enchant > 4) {
    return Response.json({ error: "Invalid enchant" }, { status: 400 });
  }
  if (!Number.isFinite(quality) || quality < 1 || quality > 5) {
    return Response.json({ error: "Invalid quality" }, { status: 400 });
  }

  const item = getItemByNumericId(id);
  if (!item) {
    return Response.json({ error: "Unknown item" }, { status: 404 });
  }

  const maxAllowedEnchant = getItemMaxEnchantLevel(item);
  if (enchant > maxAllowedEnchant) {
    return Response.json({ error: "Invalid enchant for item" }, { status: 400 });
  }

  const itemIdForPrice = resolvePriceItemId(item, enchant);
  const cacheKey = buildPriceCacheKey(itemIdForPrice, quality);
  const url = `${ALBION_PRICES_BASE}/${encodeURIComponent(itemIdForPrice)}.json?qualities=${quality}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const fallback = getCachedPricesOnly(cacheKey);
      if (fallback.rows.length > 0) {
        return Response.json({
          item,
          itemIdForPrice,
          enchant,
          quality,
          rows: fallback.rows,
          fromCache: true,
          hasStaleRows: true,
          cachedAt: fallback.savedAt,
        });
      }
      return Response.json(
        { error: "Failed to load prices", status: res.status },
        { status: 502 },
      );
    }

    const raw = (await res.json()) as AlbionPriceRow[];
    const freshRows = mapAlbionRows(raw);
    const { rows, hasStaleRows, savedAt } = resolvePricesWithCache(
      cacheKey,
      itemIdForPrice,
      quality,
      freshRows,
    );

    indexBlackMarketFromPriceFetch(id, itemIdForPrice, quality, rows);

    return Response.json({
      item,
      itemIdForPrice,
      enchant,
      quality,
      rows,
      fromCache: hasStaleRows,
      hasStaleRows,
      cachedAt: savedAt,
    });
  } catch {
    const fallback = getCachedPricesOnly(cacheKey);
    if (fallback.rows.length > 0) {
      return Response.json({
        item,
        itemIdForPrice,
        enchant,
        quality,
        rows: fallback.rows,
        fromCache: true,
        hasStaleRows: true,
        cachedAt: fallback.savedAt,
      });
    }
    return Response.json({ error: "Failed to load prices" }, { status: 502 });
  }
}
