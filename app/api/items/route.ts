import { ensureItemsReady, getItemByNumericId, searchItems, toItemWithCapabilities } from "@/lib/items";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await ensureItemsReady();
  } catch {
    return Response.json({ error: "Items database unavailable" }, { status: 503 });
  }

  const idParam = req.nextUrl.searchParams.get("id");
  if (idParam) {
    const id = Number.parseInt(idParam, 10);
    if (!Number.isFinite(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }
    const item = getItemByNumericId(id);
    if (!item) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(toItemWithCapabilities(item));
  }

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const items = searchItems(q).slice(0, 80);
  return Response.json(items);
}
