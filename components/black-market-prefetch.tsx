"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import {
  clearSharedScanState,
  readSharedScanState,
  writeSharedScanState,
} from "@/lib/black-market-prefetch-client";

const START_DELAY_MS = 2_500;
const STEP_INTERVAL_MS = 1_000;
const STEP_COUNT = 2;
const IDLE_TIMEOUT_MS = 8_000;

type MetaResponse = {
  stale?: boolean;
  cachedAt?: number | null;
  rowCount?: number;
  scanning?: boolean;
  scanProgress?: { done?: number; total?: number } | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scheduleIdle(task: () => void): void {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(task, { timeout: IDLE_TIMEOUT_MS });
    return;
  }
  setTimeout(task, 100);
}

function shouldSkipPrefetch(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (connection?.saveData) return true;
  if (connection?.effectiveType === "slow-2g") return true;
  if (connection?.effectiveType === "2g") return true;
  return false;
}

async function fetchMeta(): Promise<MetaResponse | null> {
  try {
    const res = await fetch("/api/black-market?meta=1", {
      priority: "low",
    } as RequestInit);
    if (!res.ok) return null;
    return (await res.json()) as MetaResponse;
  } catch {
    return null;
  }
}

function resolveDone(meta: MetaResponse | null): number {
  const serverDone =
    meta?.scanProgress &&
    typeof meta.scanProgress.done === "number"
      ? meta.scanProgress.done
      : null;
  if (serverDone != null && serverDone > 0) return serverDone;
  return readSharedScanState()?.done ?? 0;
}

async function runPrefetchLoop(signal: { aborted: boolean }): Promise<void> {
  const meta = await fetchMeta();
  if (signal.aborted) return;

  const cacheReady =
    meta &&
    !meta.stale &&
    !meta.scanning &&
    typeof meta.cachedAt === "number" &&
    (meta.rowCount ?? 0) > 0;
  if (cacheReady) {
    clearSharedScanState();
    return;
  }

  if (shouldSkipPrefetch()) return;

  let done = resolveDone(meta);
  const total =
    meta?.scanProgress && typeof meta.scanProgress.total === "number"
      ? meta.scanProgress.total
      : readSharedScanState()?.total ?? null;

  if (!meta?.scanning && done === 0) {
    try {
      const res = await fetch("/api/black-market?begin=1", {
        priority: "low",
      } as RequestInit);
      if (!res.ok || signal.aborted) return;
      const data = await res.json();
      const beginTotal =
        data.scanProgress &&
        typeof data.scanProgress === "object" &&
        typeof data.scanProgress.total === "number"
          ? data.scanProgress.total
          : total;
      writeSharedScanState({ done: 0, total: beginTotal, active: true });
    } catch {
      return;
    }
  } else if (done > 0) {
    writeSharedScanState({ done, total, active: true });
  }

  while (!signal.aborted) {
    if (document.visibilityState === "hidden") {
      await sleep(800);
      continue;
    }

    if (window.location.pathname === "/black-market") {
      return;
    }

    done = resolveDone(await fetchMeta()) || done;

    try {
      const res = await fetch(
        `/api/black-market?step=1&count=${STEP_COUNT}&done=${done}&background=1`,
        { priority: "low" } as RequestInit,
      );
      if (!res.ok || signal.aborted) return;

      const data = await res.json();
      const progress =
        data.scanProgress &&
        typeof data.scanProgress === "object" &&
        data.scanProgress !== null
          ? (data.scanProgress as { done?: number; total?: number })
          : null;

      done = typeof progress?.done === "number" ? progress.done : done;
      const nextTotal =
        typeof progress?.total === "number" ? progress.total : total;
      const stillScanning = Boolean(data.scanning);

      writeSharedScanState({
        done,
        total: nextTotal,
        active: stillScanning,
      });

      if (!stillScanning) {
        clearSharedScanState();
        return;
      }
    } catch {
      return;
    }

    await sleep(STEP_INTERVAL_MS);
  }
}

export function BlackMarketPrefetch() {
  const pathname = usePathname();
  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;

    if (pathname === "/black-market") {
      return undefined;
    }

    const signal = { aborted: false };
    const startTimer = window.setTimeout(() => {
      scheduleIdle(() => {
        if (signal.aborted) return;
        void runPrefetchLoop(signal);
      });
    }, START_DELAY_MS);

    return () => {
      signal.aborted = true;
      abortRef.current = true;
      window.clearTimeout(startTimer);
    };
  }, [pathname]);

  return null;
}
