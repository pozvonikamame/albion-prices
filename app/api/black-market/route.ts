import { getBlackMarketData } from "@/lib/black-market";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const step = params.get("step") === "1";
    const stepCount = Number.parseInt(params.get("count") ?? "1", 10);
    const beginScan = params.get("begin") === "1";
    const query = params.get("q")?.trim() || undefined;

    const data = await getBlackMarketData({
      step,
      stepCount: Number.isFinite(stepCount) ? stepCount : 1,
      beginScan,
      query,
    });
    return Response.json(data);
  } catch {
    return Response.json(
      { error: "Failed to load Black Market data" },
      { status: 502 },
    );
  }
}
