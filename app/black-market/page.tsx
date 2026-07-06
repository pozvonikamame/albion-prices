"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ItemIcon } from "@/components/item-icon";
import { useLanguage } from "@/components/language-provider";
import { formatItemLabel } from "@/lib/item-display";
import type { BlackMarketRow } from "@/lib/black-market-store";
import { resolveItemIconId } from "@/lib/item-icon";
import {
  buildBaseSearchHaystacks,
  buildVariantSearchHaystack,
  matchesAnyHaystack,
  matchesSearchHaystack,
  normalizeSearchValue,
} from "@/lib/item-search";

type SortBy = "buyPriceMax" | "name" | "updatedAtEpoch";
type SortDir = "asc" | "desc";

const DISPLAY_CHUNK = 80;
const KICKSTART_WAVES = 5;
const SCROLL_STEP_COUNT = 3;

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="ml-1 size-3.5 opacity-50" />;
  return dir === "asc" ? (
    <ArrowUp className="ml-1 size-3.5" />
  ) : (
    <ArrowDown className="ml-1 size-3.5" />
  );
}

function mergeRowLists(
  existing: BlackMarketRow[],
  incoming: BlackMarketRow[],
): BlackMarketRow[] {
  const map = new Map<string, BlackMarketRow>();
  for (const row of existing) {
    map.set(`${row.priceItemId}@${row.quality}`, row);
  }
  for (const row of incoming) {
    map.set(`${row.priceItemId}@${row.quality}`, row);
  }
  return [...map.values()];
}

function matchesRowQuery(row: BlackMarketRow, query: string): boolean {
  const q = normalizeSearchValue(query);
  if (!q) return true;
  if (q.length < 2) return true;

  const haystacks = buildBaseSearchHaystacks(row);
  const baseMatches = matchesAnyHaystack(q, haystacks);
  const variantHaystack = buildVariantSearchHaystack(row, row.enchant);
  const variantMatches = matchesSearchHaystack(q, variantHaystack);
  return baseMatches || variantMatches;
}

function formatCachedAt(epoch: number | null, language: string): string {
  if (!epoch) return "—";
  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(epoch);
}

export default function BlackMarketPage() {
  const { language, t } = useLanguage();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [rows, setRows] = useState<BlackMarketRow[]>([]);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("buyPriceMax");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [visibleCount, setVisibleCount] = useState(DISPLAY_CHUNK);
  const [scanProgress, setScanProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const stepInFlight = useRef(false);
  const scanningRef = useRef(false);
  const scanDoneRef = useRef(0);
  const loadSentinelRef = useRef<HTMLDivElement | null>(null);
  const handleLoadMoreRef = useRef<() => void>(() => {});
  const initialLoadDone = useRef(false);
  const autoKickStarted = useRef(false);

  const numberFmt = useMemo(
    () => new Intl.NumberFormat(language === "ru" ? "ru-RU" : "en-US"),
    [language],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  const applyPayload = useCallback(
    (data: Record<string, unknown>, options?: { merge?: boolean }) => {
      const incoming = Array.isArray(data.rows)
        ? (data.rows as BlackMarketRow[])
        : [];
      setRows((prev) =>
        options?.merge || data.incremental === true
          ? mergeRowLists(prev, incoming)
          : incoming,
      );
      setCachedAt(typeof data.cachedAt === "number" ? data.cachedAt : null);
      const nextScanning = Boolean(data.scanning);
      scanningRef.current = nextScanning;
      setScanning(nextScanning);
      setStale(Boolean(data.stale));
      const nextProgress =
        data.scanProgress &&
        typeof data.scanProgress === "object" &&
        data.scanProgress !== null &&
        typeof (data.scanProgress as { done?: unknown }).done === "number" &&
        typeof (data.scanProgress as { total?: unknown }).total === "number"
          ? (data.scanProgress as { done: number; total: number })
          : null;
      setScanProgress(nextProgress);
      if (nextProgress) {
        scanDoneRef.current = nextProgress.done;
      }
      if (typeof data.scanError === "string" && data.scanError) {
        setError(data.scanError);
      }
      if (!data.scanning) {
        setRefreshing(false);
      }
    },
    [],
  );

  const fetchScanSteps = useCallback(
    async (count: number): Promise<Record<string, unknown> | null> => {
      const res = await fetch(
        `/api/black-market?step=1&count=${count}&done=${scanDoneRef.current}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(
          typeof data?.error === "string" ? data.error : t("bm.failedLoad"),
        );
        return null;
      }
      applyPayload(data, { merge: true });
      if (Array.isArray(data.rows) && data.rows.length > 0) {
        setVisibleCount((prev) => prev + DISPLAY_CHUNK);
      }
      return data;
    },
    [applyPayload, t],
  );

  const scheduleFollowUpLoad = useCallback(() => {
    requestAnimationFrame(() => {
      const node = loadSentinelRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      if (rect.top <= window.innerHeight + 280) {
        handleLoadMoreRef.current?.();
      }
    });
  }, []);

  const beginScan = useCallback(
    async (forceRestart = false): Promise<boolean> => {
      const suffix = forceRestart ? "?begin=1&restart=1" : "?begin=1";
      const res = await fetch(`/api/black-market${suffix}`);
      const data = await res.json();
      if (!res.ok) {
        setError(
          typeof data?.error === "string" ? data.error : t("bm.failedLoad"),
        );
        return false;
      }
      scanDoneRef.current = 0;
      applyPayload(data);
      return true;
    },
    [applyPayload, t],
  );

  const runScanSteps = useCallback(
    async (count: number) => {
      if (stepInFlight.current) return;
      stepInFlight.current = true;
      setRefreshing(true);
      setError(null);

      try {
        if (!scanningRef.current) {
          const started = await beginScan();
          if (!started) return;
        }
        await fetchScanSteps(count);
        scheduleFollowUpLoad();
      } catch {
        setError(t("price.networkError"));
      } finally {
        stepInFlight.current = false;
        if (!scanningRef.current) setRefreshing(false);
      }
    },
    [beginScan, fetchScanSteps, scheduleFollowUpLoad, t],
  );

  const kickstartScan = useCallback(
    async (forceRestart = false) => {
      if (stepInFlight.current) return;
      stepInFlight.current = true;
      setRefreshing(true);
      setScanning(true);
      setError(null);

      try {
        if (forceRestart) {
          setRows([]);
          scanDoneRef.current = 0;
          const ok = await beginScan(true);
          if (!ok) return;
        } else if (!scanningRef.current) {
          const ok = await beginScan();
          if (!ok) return;
        }

        for (let i = 0; i < KICKSTART_WAVES; i += 1) {
          if (!scanningRef.current) break;
          const data = await fetchScanSteps(SCROLL_STEP_COUNT);
          if (!data?.scanning) break;
        }
        scheduleFollowUpLoad();
      } catch {
        setError(t("price.networkError"));
      } finally {
        stepInFlight.current = false;
        if (!scanningRef.current) setRefreshing(false);
      }
    },
    [beginScan, fetchScanSteps, scheduleFollowUpLoad, t],
  );

  const loadData = useCallback(
    async (options?: { silent?: boolean; query?: string }) => {
      const silent = options?.silent ?? false;
      if (!silent) setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (options?.query && options.query.trim().length >= 2) {
          params.set("q", options.query.trim());
        }
        const suffix = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`/api/black-market${suffix}`);
        const data = await res.json();
        if (!res.ok) {
          setError(
            typeof data?.error === "string" ? data.error : t("bm.failedLoad"),
          );
          return;
        }
        applyPayload(data);
      } catch {
        setError(t("price.networkError"));
      } finally {
        setLoading(false);
        initialLoadDone.current = true;
      }
    },
    [applyPayload, t],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) return;
    void loadData({ silent: true, query: q });
  }, [debouncedQuery, loadData]);

  useEffect(() => {
    if (!initialLoadDone.current || loading) return;
    if (debouncedQuery.trim().length >= 2) return;
    if (autoKickStarted.current) return;

    const needsScan = stale || !cachedAt || scanning;
    if (!needsScan) return;

    autoKickStarted.current = true;
    void kickstartScan();
  }, [loading, stale, cachedAt, scanning, debouncedQuery, kickstartScan]);

  useEffect(() => {
    setVisibleCount(DISPLAY_CHUNK);
  }, [debouncedQuery, sortBy, sortDir]);

  const filteredRows = useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q) return rows;
    return rows.filter((row) => matchesRowQuery(row, q));
  }, [rows, debouncedQuery]);

  const sortedRows = useMemo(() => {
    const multiplier = sortDir === "asc" ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      if (sortBy === "name") {
        const aName = formatItemLabel(a, language, a.enchant).toLowerCase();
        const bName = formatItemLabel(b, language, b.enchant).toLowerCase();
        return aName.localeCompare(bName) * multiplier;
      }
      if (sortBy === "updatedAtEpoch") {
        const aValue = a.updatedAtEpoch ?? -1;
        const bValue = b.updatedAtEpoch ?? -1;
        return (aValue - bValue) * multiplier;
      }
      return (a.buyPriceMax - b.buyPriceMax) * multiplier;
    });
  }, [filteredRows, sortBy, sortDir, language]);

  const visibleRows = useMemo(
    () => sortedRows.slice(0, visibleCount),
    [sortedRows, visibleCount],
  );

  const hasMoreToShow = visibleCount < sortedRows.length;
  const scanIncomplete = scanning || stale || !cachedAt;

  const handleLoadMore = useCallback(() => {
    if (hasMoreToShow) {
      setVisibleCount((prev) =>
        Math.min(prev + DISPLAY_CHUNK, sortedRows.length),
      );
      scheduleFollowUpLoad();
      return;
    }
    if (scanningRef.current || stale || !cachedAt) {
      if (!stepInFlight.current) {
        void runScanSteps(SCROLL_STEP_COUNT);
      }
    }
  }, [
    hasMoreToShow,
    runScanSteps,
    scheduleFollowUpLoad,
    sortedRows.length,
    stale,
    cachedAt,
  ]);

  handleLoadMoreRef.current = handleLoadMore;

  useEffect(() => {
    const node = loadSentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        handleLoadMore();
      },
      { rootMargin: "240px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [handleLoadMore, visibleRows.length, sortedRows.length, scanning]);

  const toggleSort = useCallback(
    (next: SortBy) => {
      if (sortBy === next) {
        setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
        return;
      }
      setSortBy(next);
      setSortDir(next === "name" ? "asc" : "desc");
    },
    [sortBy],
  );

  const handleRefresh = useCallback(() => {
    autoKickStarted.current = true;
    setVisibleCount(DISPLAY_CHUNK);
    setRows([]);
    scanDoneRef.current = 0;
    void kickstartScan(true);
  }, [kickstartScan]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="space-y-2 text-center sm:text-left">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {t("bm.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("bm.subtitle")}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("bm.searchPlaceholder")}
            spellCheck={false}
            className="h-11 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={refreshing || scanning}
          onClick={handleRefresh}
          className="shrink-0"
        >
          {refreshing || scanning ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 size-4" />
          )}
          {t("bm.refresh")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          {t("bm.foundItems")}: {sortedRows.length}
          {debouncedQuery.trim() ? ` ${t("bm.of")} ${rows.length}` : ""}
          {visibleRows.length < sortedRows.length
            ? ` · ${t("bm.shown")} ${visibleRows.length}`
            : ""}
        </span>
        {cachedAt ? (
          <span>
            · {t("bm.lastUpdate")}: {formatCachedAt(cachedAt, language)}
          </span>
        ) : null}
        {scanning ? (
          <span className="inline-flex items-center gap-1.5 text-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            {scanProgress
              ? `${t("bm.refreshing")} ${t("bm.scanProgress")} ${scanProgress.done} ${t("bm.scanOf")} ${scanProgress.total}`
              : t("bm.refreshing")}
          </span>
        ) : null}
      </div>

      {stale && !scanning && rows.length > 0 ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t("bm.cachedNotice")}
        </p>
      ) : null}

      {loading && rows.length === 0 && !scanning ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("bm.loading")}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {visibleRows.length > 0 && !error ? (
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("bm.item")}</TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort("buyPriceMax")}
                    className="inline-flex items-center hover:text-foreground"
                  >
                    {t("bm.buyPrice")}
                    <SortIcon active={sortBy === "buyPriceMax"} dir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort("updatedAtEpoch")}
                    className="inline-flex items-center hover:text-foreground"
                  >
                    {t("price.updatedAt")}
                    <SortIcon
                      active={sortBy === "updatedAtEpoch"}
                      dir={sortDir}
                    />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow key={`${row.priceItemId}-${row.quality}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ItemIcon
                        itemId={resolveItemIconId(
                          row.uniqueName,
                          row.enchant,
                          row.enchantStyle,
                        )}
                        quality={row.quality}
                        size={32}
                        alt=""
                        className="rounded-sm"
                      />
                      <span className="font-medium">
                        {formatItemLabel(row, language, row.enchant)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {numberFmt.format(row.buyPriceMax)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {row.updatedAt}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <div ref={loadSentinelRef} className="flex min-h-8 justify-center py-4">
        {(hasMoreToShow || scanIncomplete) && !error ? (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {hasMoreToShow ? t("bm.loadMore") : t("bm.scrollLoad")}
          </span>
        ) : null}
      </div>

      {!loading && !error && sortedRows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
          {debouncedQuery.trim()
            ? t("bm.notFound")
            : scanning || refreshing
              ? t("bm.refreshing")
              : t("bm.empty")}
        </p>
      ) : null}
    </main>
  );
}
