import { getItemByNumericId } from "@/lib/items";
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
export async function GET(req: NextRequest) {
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

  const itemIdForPrice =
    enchant > 0 ? `${item.baseUniqueName}@${enchant}` : item.baseUniqueName;
  const url = `${ALBION_PRICES_BASE}/${encodeURIComponent(itemIdForPrice)}.json?qualities=${quality}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) {
    return Response.json(
      { error: "Failed to load prices", status: res.status },
      { status: 502 },
    );
  }

  const raw = (await res.json()) as AlbionPriceRow[];
  const rows = raw.map((r) => {
    const { label, epoch } = latestUpdate(
      r.sell_price_min_date,
      r.buy_price_max_date,
    );
    return {
      city: r.city,
      sellPriceMin: r.sell_price_min,
      buyPriceMax: r.buy_price_max,
      updatedAt: label,
      updatedAtEpoch: epoch,
    };
  });

  return Response.json({ item, itemIdForPrice, enchant, quality, rows });
}
