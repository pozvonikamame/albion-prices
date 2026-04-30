"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { useLanguage } from "@/components/language-provider";
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
const SEARCH_FRAME_TEXTURE =
  "https://www.figma.com/api/mcp/asset/0e6d89f8-72d6-4409-bcbc-d10d5916bead";

function normalizeSearchValue(value: string): string {
  return value.toLowerCase().replace(/[\s-]+/g, "");
}

function isSubsequenceMatch(query: string, candidate: string): boolean {
  let queryIndex = 0;
  for (let i = 0; i < candidate.length && queryIndex < query.length; i += 1) {
    if (candidate[i] === query[queryIndex]) {
      queryIndex += 1;
    }
  }
  return queryIndex === query.length;
}

function matchesMapName(query: string, mapName: string): boolean {
  const normalizedName = normalizeSearchValue(mapName);
  if (normalizedName.includes(query)) {
    return true;
  }
  return isSubsequenceMatch(query, normalizedName);
}

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
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [failedImageIds, setFailedImageIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const filteredMaps = useMemo(() => {
    const q = normalizeSearchValue(debouncedQuery.trim());
    if (!q) return maps;
    return maps.filter((map) => matchesMapName(q, map.name));
  }, [debouncedQuery]);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [debouncedQuery]);

  const suggestions = useMemo(() => {
    const q = normalizeSearchValue(query.trim());
    if (!q) return [];
    const values = new Map<string, number>();
    for (const map of maps) {
      if (matchesMapName(q, map.name) && !values.has(map.name)) {
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
          {t("nav.avalonMaps")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("home.subtitle")}
        </p>
      </header>

      <div className="flex w-full items-center justify-between gap-4">
        <div className="relative h-[32px] w-full max-w-[277px] rounded-[30px] p-[4px_3px]">
          <div
            className="pointer-events-none absolute inset-0 rounded-[30px] bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${SEARCH_FRAME_TEXTURE})` }}
          />
          <div className="relative h-[24px] w-[271px] max-w-full rounded-[20px] shadow-[-1px_-1px_0.9px_0px_#707275,1px_1px_0.9px_0px_#34353d]">
            <div className="pointer-events-none absolute inset-0 rounded-[20px] bg-gradient-to-b from-[#ffd8ad] to-[#ac9275]" />
            <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_0px_1.8px_0.3px_rgba(0,0,0,0.69),inset_2px_2px_1.8px_0px_rgba(0,0,0,0.27)]" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("home.searchPlaceholder")}
              className="relative z-10 h-full w-full bg-transparent pb-0 pl-3 pr-8 pt-[2px] font-['PT_Serif'] text-[14px] leading-[normal] tracking-[-0.12px] text-[#5e422e] outline-none placeholder:text-[#5e422e] focus-visible:ring-0"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 h-0 w-0 -translate-y-1/2 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-[#5e422e]"
            />
          </div>
          {suggestions.length > 0 && (
            <div className="absolute left-[3px] top-[calc(100%+4px)] z-20 w-[271px] max-w-[calc(100%-6px)] overflow-hidden rounded-md border border-border bg-popover shadow-md">
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

        <p className="text-[10px] text-muted-foreground">
          {t("home.shownMaps")}:{" "}
          <span className="font-medium text-foreground">
            {Math.min(visibleMaps.length, filteredMaps.length)}
          </span>{" "}
          {t("home.of")} <span className="font-medium text-foreground">{filteredMaps.length}</span>
        </p>
      </div>

      

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
            <div className="relative aspect-square bg-muted">
              <Image
                src={failedImageIds.has(map.id) ? "/maps/placeholder.svg" : `/maps/${map.image}`}
                alt={map.name}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover"
                loading="lazy"
                onError={() => {
                  setFailedImageIds((prev) => {
                    if (prev.has(map.id)) return prev;
                    const next = new Set(prev);
                    next.add(map.id);
                    return next;
                  });
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
            {t("home.showMore")} {Math.min(VISIBLE_STEP, filteredMaps.length - visibleCount)}
          </Button>
        </div>
      )}

      {filteredMaps.length === 0 && (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
          {t("home.notFound")}
        </p>
      )}
    </main>
  );
}
