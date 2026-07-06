import { getBlackMarketData } from "@/lib/black-market";
import { NextRequest } from "next/server";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const step = params.get("step") === "1";
    const stepCount = Number.parseInt(params.get("count") ?? "1", 10);
    const scanDone = Number.parseInt(params.get("done") ?? "0", 10);
    const beginScan = params.get("begin") === "1";
    const clearRows = params.get("restart") === "1";
    const query = params.get("q")?.trim() || undefined;

    const data = await getBlackMarketData({
      step,
      stepCount: Number.isFinite(stepCount) ? stepCount : 1,
      scanDone: Number.isFinite(scanDone) ? scanDone : 0,
      beginScan,
      clearRows,
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
