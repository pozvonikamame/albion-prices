import {
  getBlackMarketMeta,
  runBlackMarketScanBurst,
} from "@/lib/black-market";
import { NextRequest } from "next/server";

export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const meta = await getBlackMarketMeta();
    if (!meta.stale && !meta.scanning && meta.rowCount > 0) {
      return Response.json({
        skipped: true,
        reason: "cache_fresh",
        rowCount: meta.rowCount,
        cachedAt: meta.cachedAt,
      });
    }

    const result = await runBlackMarketScanBurst({ timeBudgetMs: 55_000 });
    return Response.json({
      skipped: false,
      ...result,
    });
  } catch {
    return Response.json(
      { error: "Black Market cron scan failed" },
      { status: 502 },
    );
  }
}
