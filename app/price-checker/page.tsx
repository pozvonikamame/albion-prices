"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronsUpDown,
  Loader2,
} from "lucide-react";
import Link from "next/link";

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
import { cn } from "@/lib/utils";

type ItemOption = {
  id: number;
  uniqueName: string;
  name: string;
  ruName: string;
  baseName: string;
  tier: number | null;
};

type PriceRow = {
  city: string;
  sellPriceMin: number;
  buyPriceMax: number;
  updatedAt: string;
  updatedAtEpoch: number | null;
};

type SortBy = "sellPriceMin" | "buyPriceMax" | "updatedAtEpoch";
type SortDir = "asc" | "desc";

function itemLabel(item: ItemOption): string {
  const title =
    item.ruName?.trim() ||
    item.baseName?.trim() ||
    item.name?.trim() ||
    item.uniqueName;
  const tierText = item.tier ? `T${item.tier}` : "T?";
  return `${title} (${tierText})`;
}

const numberFmt = new Intl.NumberFormat("ru-RU");

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="ml-1 size-3.5 opacity-50" />;
  return dir === "asc" ? (
    <ArrowUp className="ml-1 size-3.5" />
  ) : (
    <ArrowDown className="ml-1 size-3.5" />
  );
}

export default function PriceCheckerPage() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<ItemOption[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selected, setSelected] = useState<ItemOption | null>(null);
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [enchantFilter, setEnchantFilter] = useState<number>(0);
  const [qualityFilter, setQualityFilter] = useState<number>(1);

  const [pricesLoading, setPricesLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [priceRows, setPriceRows] = useState<PriceRow[]>([]);
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortBy>("sellPriceMin");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 280);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.trim().length === 0) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setItemsLoading(true);
    const tierParam = tierFilter === "all" ? "" : `&tier=${tierFilter}`;
    fetch(`/api/items?q=${encodeURIComponent(debouncedQuery)}${tierParam}`)
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
  }, [debouncedQuery, tierFilter]);

  const loadPrices = useCallback(async (item: ItemOption) => {
    setPricesLoading(true);
    setPriceError(null);
    setPriceRows([]);
    try {
      const params = new URLSearchParams({
        id: String(item.id),
        enchant: String(enchantFilter),
        quality: String(qualityFilter),
      });
      const res = await fetch(`/api/prices?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setPriceError(
          typeof data?.error === "string" ? data.error : "Не удалось загрузить цены",
        );
        return;
      }
      setPriceRows(Array.isArray(data.rows) ? data.rows : []);
    } catch {
      setPriceError("Ошибка сети");
    } finally {
      setPricesLoading(false);
    }
  }, [enchantFilter, qualityFilter]);

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

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="space-y-2 text-center sm:text-left">
        <Button asChild variant="outline" className="mb-2 w-fit">
          <Link href="/">
            <ArrowLeft className="size-4" />
            На главную
          </Link>
        </Button>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Albion Price Checker
        </h1>
        <p className="text-sm text-muted-foreground">
          Найдите предмет и посмотрите цены по городам с фильтрами tier, чар и качества.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">
          Предмет
        </label>
        <div className="grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            value={tierFilter}
            onChange={(e) => {
              setTierFilter(e.target.value);
              setSelected(null);
              setPriceRows([]);
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Tier: Все</option>
            <option value="1">Tier: T1</option>
            <option value="2">Tier: T2</option>
            <option value="3">Tier: T3</option>
            <option value="4">Tier: T4</option>
            <option value="5">Tier: T5</option>
            <option value="6">Tier: T6</option>
            <option value="7">Tier: T7</option>
            <option value="8">Tier: T8</option>
          </select>
          <select
            value={enchantFilter}
            onChange={(e) => setEnchantFilter(Number.parseInt(e.target.value, 10))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value={0}>Чары: без чар</option>
            <option value={1}>Чары: .1</option>
            <option value={2}>Чары: .2</option>
            <option value={3}>Чары: .3</option>
            <option value={4}>Чары: .4</option>
          </select>
          <select
            value={qualityFilter}
            onChange={(e) => setQualityFilter(Number.parseInt(e.target.value, 10))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value={1}>Качество: Обычное (1)</option>
            <option value={2}>Качество: Хорошее (2)</option>
            <option value={3}>Качество: Выдающееся (3)</option>
            <option value={4}>Качество: Отличное (4)</option>
            <option value={5}>Качество: Шедевр (5)</option>
          </select>
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="h-11 w-full max-w-xl justify-between font-normal"
            >
              <span className="truncate text-left">
                {selected ? itemLabel(selected) : "Выберите предмет…"}
              </span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(100vw-2rem,36rem)] max-w-xl p-0">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Поиск по названию или ID…"
                value={query}
                onValueChange={setQuery}
              />
              <CommandList>
                {itemsLoading && debouncedQuery.trim().length > 0 ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Поиск…
                  </div>
                ) : (
                  <>
                    <CommandEmpty>
                      {debouncedQuery.trim().length === 0
                        ? "Введите запрос для поиска"
                        : "Ничего не найдено"}
                    </CommandEmpty>
                    <CommandGroup>
                      {items.map((item) => (
                        <CommandItem
                          key={item.id}
                          value={`${item.id}-${item.uniqueName}`}
                          onSelect={() => {
                            setSelected(item);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 size-4 shrink-0",
                              selected?.id === item.id
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate font-medium">
                              {item.ruName?.trim() || item.baseName?.trim() || item.name?.trim() || item.uniqueName}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {item.uniqueName} · {item.tier ? `T${item.tier}` : "T?"} · id {item.id}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-foreground">Рыночные цены</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Город: Все</option>
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
            <option value="desc">Порядок: по убыванию</option>
            <option value="asc">Порядок: по возрастанию</option>
          </select>
          <div className="flex items-center rounded-md border border-input bg-muted/30 px-3 text-xs text-muted-foreground sm:col-span-1">
            Сортировка: клик по заголовку столбца
          </div>
        </div>

        {!selected && (
          <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            Выберите предмет выше — таблица заполнится автоматически.
          </p>
        )}

        {selected && pricesLoading && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Загрузка цен для{" "}
            <span className="font-medium text-foreground">
              {itemLabel(selected)}
            </span>
            …
          </div>
        )}

        {selected && priceError && !pricesLoading && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {priceError}
          </p>
        )}

        {selected && !pricesLoading && !priceError && displayedRows.length > 0 && (
          <div className="rounded-lg border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Город</TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("sellPriceMin")}
                      className="inline-flex items-center text-right hover:text-foreground"
                    >
                      Цена продажи (Sell Price Min)
                      <SortIcon active={sortBy === "sellPriceMin"} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("buyPriceMax")}
                      className="inline-flex items-center text-right hover:text-foreground"
                    >
                      Цена покупки (Buy Price Max)
                      <SortIcon active={sortBy === "buyPriceMax"} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort("updatedAtEpoch")}
                      className="inline-flex items-center text-right hover:text-foreground"
                    >
                      Время обновления
                      <SortIcon active={sortBy === "updatedAtEpoch"} dir={sortDir} />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedRows.map((row) => (
                  <TableRow key={row.city}>
                    <TableCell className="font-medium">{row.city}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {numberFmt.format(row.sellPriceMin)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
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
        )}

        {selected && !pricesLoading && !priceError && displayedRows.length === 0 && (
          <p className="rounded-lg border border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            Нет данных по выбранным фильтрам города/сортировки.
          </p>
        )}
      </section>
    </main>
  );
}
