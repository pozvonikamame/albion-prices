"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import mapsData from "@/src/data/maps.json";

type AvalonMap = {
  id: number;
  name: string;
  tier: number;
  image: string;
};

const maps = (mapsData as { maps: AvalonMap[] }).maps;
const INITIAL_VISIBLE = 36;
const VISIBLE_STEP = 36;

function toRoman(tier: number): string {
  const romans: Record<number, string> = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V",
    6: "VI",
    7: "VII",
    8: "VIII",
  };
  return romans[tier] ?? String(tier);
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const filteredMaps = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return maps;
    return maps.filter((map) => map.name.toLowerCase().includes(q));
  }, [debouncedQuery]);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [debouncedQuery]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const values = new Map<string, number>();
    for (const map of maps) {
      if (map.name.toLowerCase().includes(q) && !values.has(map.name)) {
        values.set(map.name, map.tier);
      }
    }
    return Array.from(values.entries())
      .slice(0, 8)
      .map(([name, tier]) => ({ name, tier }));
  }, [query]);

  const visibleMaps = useMemo(
    () => filteredMaps.slice(0, visibleCount),
    [filteredMaps, visibleCount],
  );
  const hasMore = visibleCount < filteredMaps.length;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Avalon Maps
        </h1>
        <p className="text-sm text-muted-foreground">
          Поиск по названию карты, тиру или типу ресурса.
        </p>
        <Button asChild variant="secondary" className="mt-2 w-fit">
          <Link href="/price-checker">Открыть Price Checker</Link>
        </Button>
      </header>

      <div className="relative max-w-xl">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Например: T6, Cases или ORE"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
        {suggestions.length > 0 && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.name}
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => setQuery(suggestion.name)}
              >
                <span className="truncate">{suggestion.name}</span>
                <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {toRoman(suggestion.tier)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Показано карт:{" "}
        <span className="font-medium text-foreground">
          {Math.min(visibleMaps.length, filteredMaps.length)}
        </span>{" "}
        из <span className="font-medium text-foreground">{filteredMaps.length}</span>
      </p>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleMaps.map((map) => (
          <article
            key={map.id}
            className="overflow-hidden rounded-lg border border-border bg-card shadow-sm"
          >
            <div className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="truncate text-xl font-semibold text-foreground">{map.name}</h2>
                <span className="rounded-md bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">
                  {toRoman(map.tier)}
                </span>
              </div>
            </div>
            <div className="aspect-square bg-muted">
              <img
                src={`/maps/${map.image}`}
                alt={map.name}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={(event) => {
                  const target = event.currentTarget;
                  target.onerror = null;
                  target.src = "/maps/placeholder.svg";
                }}
              />
            </div>
          </article>
        ))}
      </section>

      {hasMore && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => setVisibleCount((prev) => prev + VISIBLE_STEP)}
          >
            Показать еще {Math.min(VISIBLE_STEP, filteredMaps.length - visibleCount)}
          </Button>
        </div>
      )}

      {filteredMaps.length === 0 && (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
          По вашему запросу карты не найдены.
        </p>
      )}
    </main>
  );
}
