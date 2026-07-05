"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronsUpDown,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  buildClientPriceCacheKey,
  readClientPriceCache,
  writeClientPriceCache,
} from "@/lib/price-cache-client";
import { formatItemLabel } from "@/lib/item-display";
import { resolveItemIconId } from "@/lib/item-icon";
import { pushRecentItem, readRecentItems, type RecentItem } from "@/lib/recent-items";
import { cn } from "@/lib/utils";

type ItemCapabilities = {
  tiers: Array<{ tier: number; id: number }>;
  enchants: number[];
  qualities: number[];
  enchantStyle: "none" | "gear" | "resource";
};

type ItemOption = {
  id: number;
  uniqueName: string;
  name: string;
  ruName: string;
  baseName: string;
  tier: number | null;
  capabilities: ItemCapabilities;
  listEnchant?: number;
  selectedEnchant?: number;
};

type PriceRow = {
  city: string;
  sellPriceMin: number;
  buyPriceMax: number;
  updatedAt: string;
  updatedAtEpoch: number | null;
  stale?: boolean;
};

type SortBy = "sellPriceMin" | "buyPriceMax" | "updatedAtEpoch";
type SortDir = "asc" | "desc";

function itemIconId(
  item: ItemOption,
  enchant: number,
): string {
  return resolveItemIconId(
    item.uniqueName,
    enchant,
    item.capabilities?.enchantStyle ?? "none",
  );
}

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

export default function PriceCheckerPage() {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<ItemOption[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selected, setSelected] = useState<ItemOption | null>(null);
  const [enchantFilter, setEnchantFilter] = useState<number>(0);
  const [qualityFilter, setQualityFilter] = useState<number>(1);
  const [tierSwitching, setTierSwitching] = useState(false);

  const [pricesLoading, setPricesLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [priceRows, setPriceRows] = useState<PriceRow[]>([]);
  const [hasStaleRows, setHasStaleRows] = useState(false);
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortBy>("sellPriceMin");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const numberFmt = useMemo(
    () => new Intl.NumberFormat(language === "ru" ? "ru-RU" : "en-US"),
    [language],
  );

  useEffect(() => {
    setRecentItems(readRecentItems());
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.trim().length === 0) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setItemsLoading(true);
    fetch(`/api/items?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((data: ItemOption[]) => {
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setItemsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const showTierOptions = (selected?.capabilities?.tiers.length ?? 0) > 1;
  const showEnchantOptions = (selected?.capabilities?.enchants.length ?? 0) > 1;
  const showQualityOptions = (selected?.capabilities?.qualities.length ?? 0) > 1;
  const showItemOptions = Boolean(
    selected && (showTierOptions || showEnchantOptions || showQualityOptions),
  );

  const handleSelectItem = useCallback((item: ItemOption) => {
    const enchant = item.listEnchant ?? item.selectedEnchant ?? 0;
    const base: Omit<ItemOption, "listEnchant" | "selectedEnchant"> = {
      id: item.id,
      uniqueName: item.uniqueName,
      name: item.name,
      ruName: item.ruName,
      baseName: item.baseName,
      tier: item.tier,
      capabilities: item.capabilities,
    };
    setSelected(base);
    setEnchantFilter(enchant);
    setQualityFilter(1);
    setPriceRows([]);
    setHasStaleRows(false);
    setOpen(false);
    pushRecentItem({ ...base, selectedEnchant: enchant });
    setRecentItems(readRecentItems());
  }, []);

  const handleTierChange = useCallback(async (tier: number) => {
    if (!selected) return;
    const variant = selected.capabilities?.tiers.find((entry) => entry.tier === tier);
    if (!variant || variant.id === selected.id) return;

    setTierSwitching(true);
    try {
      const res = await fetch(`/api/items?id=${variant.id}`);
      if (!res.ok) return;
      const data = (await res.json()) as ItemOption;
      setSelected(data);
      setEnchantFilter(0);
      setQualityFilter(1);
    } finally {
      setTierSwitching(false);
    }
  }, [selected]);

  const loadPrices = useCallback(async (item: ItemOption) => {
    const clientCacheKey = buildClientPriceCacheKey(
      item.id,
      enchantFilter,
      qualityFilter,
    );
    const localCached = readClientPriceCache(clientCacheKey);

    setPricesLoading(true);
    setPriceError(null);
    if (localCached?.rows.length) {
      setPriceRows(localCached.rows);
      setHasStaleRows(localCached.rows.some((row) => row.stale));
    }

    try {
      const params = new URLSearchParams({
        id: String(item.id),
        enchant: String(enchantFilter),
        quality: String(qualityFilter),
      });
      const res = await fetch(`/api/prices?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        if (localCached?.rows.length) {
          setPriceRows(localCached.rows);
          setHasStaleRows(true);
          return;
        }
        setPriceError(
          typeof data?.error === "string" ? data.error : t("price.failedLoad"),
        );
        return;
      }
      const rows = Array.isArray(data.rows) ? (data.rows as PriceRow[]) : [];
      setPriceRows(rows);
      setHasStaleRows(Boolean(data.hasStaleRows));
      if (rows.length > 0) {
        writeClientPriceCache(clientCacheKey, rows);
      }
    } catch {
      if (localCached?.rows.length) {
        setPriceRows(localCached.rows);
        setHasStaleRows(true);
        return;
      }
      setPriceError(t("price.networkError"));
    } finally {
      setPricesLoading(false);
    }
  }, [enchantFilter, qualityFilter, t]);

  useEffect(() => {
    if (!selected) return;
    void loadPrices(selected);
  }, [selected, loadPrices]);

  const availableCities = useMemo(() => {
    return Array.from(new Set(priceRows.map((r) => r.city))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [priceRows]);

  const displayedRows = useMemo(() => {
    const filtered =
      cityFilter === "all"
        ? priceRows
        : priceRows.filter((row) => row.city === cityFilter);
    const multiplier = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === "updatedAtEpoch") {
        const aValue = a.updatedAtEpoch ?? -1;
        const bValue = b.updatedAtEpoch ?? -1;
        return (aValue - bValue) * multiplier;
      }
      return (a[sortBy] - b[sortBy]) * multiplier;
    });
  }, [cityFilter, priceRows, sortBy, sortDir]);

  useEffect(() => {
    if (cityFilter === "all") return;
    const exists = priceRows.some((row) => row.city === cityFilter);
    if (!exists) setCityFilter("all");
  }, [cityFilter, priceRows]);

  const toggleSort = useCallback((next: SortBy) => {
    if (sortBy === next) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(next);
    setSortDir("desc");
  }, [sortBy]);

  const showRecentItems =
    query.trim().length === 0 && recentItems.length > 0;

  const itemLabel = useCallback(
    (item: ItemOption, enchant = 0) => formatItemLabel(item, language, enchant),
    [language],
  );

  const renderSearchItem = (item: ItemOption) => {
    const enchant = item.listEnchant ?? item.selectedEnchant ?? 0;
    const rowKey = `${item.id}-${enchant}`;

    return (
      <CommandItem
        key={rowKey}
        value={`${rowKey}-${item.uniqueName}`}
        onSelect={() => handleSelectItem(item)}
        className="gap-2"
      >
        <Check
          className={cn(
            "size-4 shrink-0",
            selected?.id === item.id && enchantFilter === enchant
              ? "opacity-100"
              : "opacity-0",
          )}
        />
        <ItemIcon
          itemId={itemIconId(item, enchant)}
          size={32}
          alt=""
          className="rounded-sm"
        />
        <span className="min-w-0 flex-1 truncate font-medium">
          {itemLabel(item, enchant)}
        </span>
      </CommandItem>
    );
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="space-y-2 text-center sm:text-left">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {t("price.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("price.subtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-sm font-medium text-foreground">
          {t("price.itemLabel")}
        </label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="h-11 w-full max-w-xl justify-between font-normal"
            >
              <span className="truncate text-left">
                {selected ? itemLabel(selected, enchantFilter) : t("price.selectItem")}
              </span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(100vw-2rem,36rem)] max-w-xl p-0">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder={t("price.searchByNameOrId")}
                value={query}
                onValueChange={setQuery}
              />
              <CommandList>
                {itemsLoading && debouncedQuery.trim().length > 0 ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    {t("price.searching")}
                  </div>
                ) : (
                  <>
                    <CommandEmpty>
                      {debouncedQuery.trim().length === 0
                        ? showRecentItems
                          ? null
                          : t("price.typeToSearch")
                        : t("price.nothingFound")}
                    </CommandEmpty>
                    {showRecentItems && (
                      <CommandGroup heading={t("price.recentItems")}>
                        {recentItems.map((item) => renderSearchItem(item))}
                      </CommandGroup>
                    )}
                    {debouncedQuery.trim().length > 0 && (
                      <CommandGroup>
                        {items.map((item) => renderSearchItem(item))}
                      </CommandGroup>
                    )}
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {showItemOptions && (
          <div
            className={cn(
              "grid max-w-xl grid-cols-1 gap-2",
              showTierOptions && showEnchantOptions && showQualityOptions
                ? "sm:grid-cols-3"
                : "sm:grid-cols-2",
            )}
          >
            {showTierOptions && (
              <select
                value={selected?.tier ?? ""}
                disabled={tierSwitching}
                onChange={(event) => {
                  void handleTierChange(Number.parseInt(event.target.value, 10));
                }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
              >
                {selected?.capabilities.tiers.map((entry) => (
                  <option key={entry.tier} value={entry.tier}>
                    Tier: T{entry.tier}
                  </option>
                ))}
              </select>
            )}
            {showEnchantOptions && (
              <select
                value={enchantFilter}
                onChange={(event) =>
                  setEnchantFilter(Number.parseInt(event.target.value, 10))
                }
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {selected?.capabilities.enchants.map((level) => (
                  <option key={level} value={level}>
                    {level === 0
                      ? t("price.enchantNone")
                      : `${t("price.enchant")}: .${level}`}
                  </option>
                ))}
              </select>
            )}
            {showQualityOptions && (
              <select
                value={qualityFilter}
                onChange={(event) =>
                  setQualityFilter(Number.parseInt(event.target.value, 10))
                }
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {selected?.capabilities.qualities.map((level) => (
                  <option key={level} value={level}>
                    {t(QUALITY_LABEL_KEYS[level] ?? "price.qualityNormal")}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-foreground">
          {t("price.marketPrices")}
          {selected ? (
            <span className="ml-2 text-base font-normal text-muted-foreground">
              — {itemLabel(selected, enchantFilter)}
            </span>
          ) : null}
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">{t("price.cityAll")}</option>
            {availableCities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
          <select
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value as SortDir)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="desc">{t("price.orderDesc")}</option>
            <option value="asc">{t("price.orderAsc")}</option>
          </select>
          <div className="flex items-center rounded-md border border-input bg-muted/30 px-3 text-xs text-muted-foreground sm:col-span-1">
            {t("price.sortHint")}
          </div>
        </div>

        {!selected && (
          <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            {t("price.selectItemHint")}
          </p>
        )}

        {selected && hasStaleRows && !pricesLoading && !priceError && (
          <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            {t("price.cachedNotice")}
          </p>
        )}

        {selected && pricesLoading && priceRows.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("price.loadingFor")}{" "}
            <span className="font-medium text-foreground">
              {itemLabel(selected, enchantFilter)}
            </span>
            …
          </div>
        )}

        {selected && priceError && !pricesLoading && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {priceError}
          </p>
        )}

        {selected && !priceError && displayedRows.length > 0 && (
          <div className="space-y-2">
            {pricesLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                {t("price.refreshing")}
              </div>
            )}
            <div className="rounded-lg border border-border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("price.city")}</TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort("sellPriceMin")}
                        className="inline-flex items-center text-right hover:text-foreground"
                      >
                        {t("price.sellPriceMin")}
                        <SortIcon active={sortBy === "sellPriceMin"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort("buyPriceMax")}
                        className="inline-flex items-center text-right hover:text-foreground"
                      >
                        {t("price.buyPriceMax")}
                        <SortIcon active={sortBy === "buyPriceMax"} dir={sortDir} />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort("updatedAtEpoch")}
                        className="inline-flex items-center text-right hover:text-foreground"
                      >
                        {t("price.updatedAt")}
                        <SortIcon active={sortBy === "updatedAtEpoch"} dir={sortDir} />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedRows.map((row) => (
                    <TableRow key={row.city} className={row.stale ? "opacity-80" : undefined}>
                      <TableCell className="font-medium">{row.city}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {numberFmt.format(row.sellPriceMin)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {numberFmt.format(row.buyPriceMax)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {row.updatedAt}
                        {row.stale ? ` ${t("price.cachedRow")}` : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {selected && !pricesLoading && !priceError && displayedRows.length === 0 && (
          <p className="rounded-lg border border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            {t("price.noData")}
          </p>
        )}
      </section>
    </main>
  );
}
