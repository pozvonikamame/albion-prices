"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { BlackMarketGearPicker } from "@/components/black-market-gear-picker";
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
import {
  clearSharedScanState,
  readSharedScanState,
  writeSharedScanState,
} from "@/lib/black-market-prefetch-client";
import { rowGearSuffix } from "@/lib/gear-picker-tree";
import { resolveItemIconId } from "@/lib/item-icon";

type SortBy = "buyPriceMax" | "name" | "quality" | "updatedAtEpoch";
type SortDir = "asc" | "desc";

const DISPLAY_CHUNK = 80;
const KICKSTART_WAVES = 4;
const SCROLL_STEP_COUNT = 6;

const QUALITY_LABEL_KEYS: Record<number, string> = {
  1: "price.qualityNormal",
  2: "price.qualityGood",
  3: "price.qualityOutstanding",
  4: "price.qualityExcellent",
  5: "price.qualityMasterpiece",
};

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

function hasActiveFilters(options: {
  selectedGear: string[];
  tierFilter: number;
  enchantFilter: number;
  qualityFilter: number;
}): boolean {
  return (
    options.selectedGear.length > 0 ||
    options.tierFilter !== 0 ||
    options.enchantFilter !== -1 ||
    options.qualityFilter !== 0
  );
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
  const [selectedGear, setSelectedGear] = useState<string[]>([]);
  const [tierFilter, setTierFilter] = useState(0);
  const [enchantFilter, setEnchantFilter] = useState(-1);
  const [qualityFilter, setQualityFilter] = useState(0);
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
  const hadActiveFilters = useRef(false);

  const numberFmt = useMemo(
    () => new Intl.NumberFormat(language === "ru" ? "ru-RU" : "en-US"),
    [language],
  );

  const selectedGearSet = useMemo(
    () => new Set(selectedGear),
    [selectedGear],
  );

  const filtersActive = hasActiveFilters({
    selectedGear,
    tierFilter,
    enchantFilter,
    qualityFilter,
  });

  const buildScanQuery = useCallback((): string => {
    if (!filtersActive) return "";
    const params = new URLSearchParams();
    if (tierFilter) params.set("tier", String(tierFilter));
    if (enchantFilter >= 0) params.set("enchant", String(enchantFilter));
    if (qualityFilter) params.set("quality", String(qualityFilter));
    if (selectedGear.length) params.set("gear", selectedGear.join(","));
    const qs = params.toString();
    return qs ? `&${qs}` : "";
  }, [
    filtersActive,
    tierFilter,
    enchantFilter,
    qualityFilter,
    selectedGear,
  ]);

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
        if (!filtersActive) {
          writeSharedScanState({
            done: nextProgress.done,
            total: nextProgress.total,
            active: nextScanning,
          });
        }
      }
      if (!nextScanning && !filtersActive) {
        clearSharedScanState();
      }
      if (typeof data.scanError === "string" && data.scanError) {
        setError(data.scanError);
      }
      if (!data.scanning) {
        setRefreshing(false);
      }
    },
    [filtersActive],
  );

  const fetchScanSteps = useCallback(
    async (count: number): Promise<Record<string, unknown> | null> => {
      const res = await fetch(
        `/api/black-market?step=1&count=${count}&done=${scanDoneRef.current}&turbo=1${buildScanQuery()}`,
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
    [applyPayload, buildScanQuery, t],
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
      const suffix = `?begin=1${forceRestart ? "&restart=1" : ""}${buildScanQuery()}`;
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
    [applyPayload, buildScanQuery, t],
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

  const resumeSharedScan = useCallback((): boolean => {
    if (filtersActive) return false;
    const shared = readSharedScanState();
    if (shared && shared.done > 0) {
      scanDoneRef.current = shared.done;
      scanningRef.current = true;
      setScanning(true);
      if (shared.total != null) {
        setScanProgress({ done: shared.done, total: shared.total });
      }
      return true;
    }
    if (scanDoneRef.current > 0 && scanningRef.current) {
      return true;
    }
    return false;
  }, [filtersActive]);

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
          clearSharedScanState();
          const ok = await beginScan(true);
          if (!ok) return;
        } else if (resumeSharedScan()) {
          // Continue background prefetch from another page.
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
    [beginScan, fetchScanSteps, resumeSharedScan, scheduleFollowUpLoad, t],
  );

  const loadData = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!silent) setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/black-market");
        const data = await res.json();
        if (!res.ok) {
          setError(
            typeof data?.error === "string" ? data.error : t("bm.failedLoad"),
          );
          return;
        }
        applyPayload(data);
        if (!filtersActive) {
          resumeSharedScan();
        }
      } catch {
        setError(t("price.networkError"));
      } finally {
        setLoading(false);
        initialLoadDone.current = true;
      }
    },
    [applyPayload, filtersActive, resumeSharedScan, t],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!initialLoadDone.current || loading) return;
    if (filtersActive) return;
    if (autoKickStarted.current) return;

    const shared = readSharedScanState();
    const serverScanning = scanning && scanProgress != null && scanProgress.done > 0;
    const needsScan =
      stale ||
      !cachedAt ||
      scanning ||
      (shared?.active && shared.done > 0) ||
      serverScanning;
    if (!needsScan) return;

    autoKickStarted.current = true;
    void kickstartScan();
  }, [loading, stale, cachedAt, scanning, scanProgress, kickstartScan, filtersActive]);

  useEffect(() => {
    if (!initialLoadDone.current) return;

    if (filtersActive) {
      hadActiveFilters.current = true;
      setRows([]);
      scanDoneRef.current = 0;
      scanningRef.current = false;
      autoKickStarted.current = true;
      void kickstartScan(true);
      return;
    }

    if (hadActiveFilters.current) {
      hadActiveFilters.current = false;
      autoKickStarted.current = false;
      void loadData({ silent: true });
    }
  }, [
    selectedGear,
    tierFilter,
    enchantFilter,
    qualityFilter,
    filtersActive,
    kickstartScan,
    loadData,
  ]);

  useEffect(() => {
    setVisibleCount(DISPLAY_CHUNK);
  }, [selectedGear, tierFilter, enchantFilter, qualityFilter, sortBy, sortDir]);

  const gearFilteredRows = useMemo(() => {
    if (selectedGearSet.size === 0) return rows;
    return rows.filter((row) => {
      const suffix = rowGearSuffix(row.baseUniqueName);
      return suffix != null && selectedGearSet.has(suffix);
    });
  }, [rows, selectedGearSet]);

  const tierFilteredRows = useMemo(() => {
    if (tierFilter === 0) return gearFilteredRows;
    return gearFilteredRows.filter((row) => row.tier === tierFilter);
  }, [gearFilteredRows, tierFilter]);

  const enchantFilteredRows = useMemo(() => {
    if (enchantFilter === -1) return tierFilteredRows;
    return tierFilteredRows.filter((row) => row.enchant === enchantFilter);
  }, [tierFilteredRows, enchantFilter]);

  const filteredRows = useMemo(() => {
    if (qualityFilter === 0) return enchantFilteredRows;
    return enchantFilteredRows.filter((row) => row.quality === qualityFilter);
  }, [enchantFilteredRows, qualityFilter]);

  const sortedRows = useMemo(() => {
    const multiplier = sortDir === "asc" ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      if (sortBy === "name") {
        const aName = formatItemLabel(a, language, a.enchant).toLowerCase();
        const bName = formatItemLabel(b, language, b.enchant).toLowerCase();
        return aName.localeCompare(bName) * multiplier;
      }
      if (sortBy === "quality") {
        return (a.quality - b.quality) * multiplier;
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
  const scanIncomplete = filtersActive
    ? scanning
    : scanning || stale || !cachedAt;

  const handleLoadMore = useCallback(() => {
    if (hasMoreToShow) {
      setVisibleCount((prev) =>
        Math.min(prev + DISPLAY_CHUNK, sortedRows.length),
      );
      scheduleFollowUpLoad();
      return;
    }
    if (scanningRef.current || (!filtersActive && (stale || !cachedAt))) {
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
    filtersActive,
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
      setSortDir(next === "name" || next === "quality" ? "asc" : "desc");
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

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex w-full flex-col gap-3 lg:max-w-3xl">
            <BlackMarketGearPicker
              selectedIds={selectedGear}
              onChange={setSelectedGear}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <select
                value={tierFilter}
                onChange={(event) =>
                  setTierFilter(Number.parseInt(event.target.value, 10))
                }
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                aria-label={t("bm.tierAll")}
              >
                <option value={0}>{t("bm.tierAll")}</option>
                {[4, 5, 6, 7, 8].map((tier) => (
                  <option key={tier} value={tier}>
                    Tier {tier}
                  </option>
                ))}
              </select>
              <select
                value={enchantFilter}
                onChange={(event) =>
                  setEnchantFilter(Number.parseInt(event.target.value, 10))
                }
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                aria-label={t("bm.enchantAll")}
              >
                <option value={-1}>{t("bm.enchantAll")}</option>
                <option value={0}>{t("price.enchantNone")}</option>
                {[1, 2, 3, 4].map((level) => (
                  <option key={level} value={level}>
                    {t("price.enchant")}: .{level}
                  </option>
                ))}
              </select>
              <select
                value={qualityFilter}
                onChange={(event) =>
                  setQualityFilter(Number.parseInt(event.target.value, 10))
                }
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                aria-label={t("bm.quality")}
              >
                <option value={0}>{t("bm.qualityAll")}</option>
                {[1, 2, 3, 4, 5].map((level) => (
                  <option key={level} value={level}>
                    {t(QUALITY_LABEL_KEYS[level] ?? "price.qualityNormal")}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={refreshing || scanning}
            onClick={handleRefresh}
            className="shrink-0 self-start"
          >
            {refreshing || scanning ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            {t("bm.refresh")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          {t("bm.foundItems")}: {sortedRows.length}
          {filtersActive ? ` ${t("bm.of")} ${rows.length}` : ""}
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
                <TableHead>
                  <button
                    type="button"
                    onClick={() => toggleSort("quality")}
                    className="inline-flex items-center hover:text-foreground"
                  >
                    {t("bm.quality")}
                    <SortIcon active={sortBy === "quality"} dir={sortDir} />
                  </button>
                </TableHead>
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
                  <TableCell className="text-muted-foreground">
                    {t(QUALITY_LABEL_KEYS[row.quality] ?? "price.qualityNormal")}
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
          {scanIncomplete && filtersActive
            ? t("bm.scanningFiltered")
            : filtersActive
              ? t("bm.notFound")
              : scanning || refreshing
                ? t("bm.refreshing")
                : t("bm.empty")}
        </p>
      ) : null}
    </main>
  );
}
