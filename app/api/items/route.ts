import { searchItems } from "@/lib/items";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const tierParam = req.nextUrl.searchParams.get("tier");
  const tier = tierParam ? Number.parseInt(tierParam, 10) : null;
  const items = searchItems(q)
    .filter((item) => (tier ? item.tier === tier : true))
    .slice(0, 80);
  return Response.json(items);
}
