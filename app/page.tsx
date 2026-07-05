"use client";

import Image from "next/image";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { DecorThemedImgFill } from "@/components/decor-themed-img";
import { HomeNotice } from "@/components/home-notice";
import { HomeSearchTypingDemo } from "@/components/home-search-typing-demo";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { latinNameToCyrillicSearchString } from "@/src/lib/latin-to-cyrillic-search";
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

function normalizeSearchValue(value: string): string {
  return value.toLowerCase().replace(/[\s-]+/g, "");
}

const mapSearchHaystacks = new Map<string, { latin: string; cyr: string }>();
for (const m of maps) {
  if (!mapSearchHaystacks.has(m.name)) {
    mapSearchHaystacks.set(m.name, {
      latin: normalizeSearchValue(m.name),
      cyr: normalizeSearchValue(latinNameToCyrillicSearchString(m.name)),
    });
  }
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
  const hay = mapSearchHaystacks.get(mapName);
  if (!hay) {
    const latin = normalizeSearchValue(mapName);
    const cyr = normalizeSearchValue(latinNameToCyrillicSearchString(mapName));
    if (latin.includes(query) || cyr.includes(query)) return true;
    return isSubsequenceMatch(query, latin) || isSubsequenceMatch(query, cyr);
  }
  if (hay.latin.includes(query) || hay.cyr.includes(query)) {
    return true;
  }
  return isSubsequenceMatch(query, hay.latin) || isSubsequenceMatch(query, hay.cyr);
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchAreaRef = useRef<HTMLDivElement | null>(null);
  const searchBlurTimeoutRef = useRef<number>(0);

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

  useEffect(() => {
    return () => window.clearTimeout(searchBlurTimeoutRef.current);
  }, []);

  useEffect(() => {
    function handleOutsidePointer(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!searchAreaRef.current?.contains(target)) {
        setIsSearchOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsidePointer);
    document.addEventListener("touchstart", handleOutsidePointer);
    return () => {
      document.removeEventListener("mousedown", handleOutsidePointer);
      document.removeEventListener("touchstart", handleOutsidePointer);
    };
  }, []);

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
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 bg-[var(--home-page-bg)] px-4 pt-12 pb-10 sm:gap-8 sm:px-6 sm:pt-16">
      <header className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center">
        <h1 className="text-[42px] font-bold tracking-[0.02em] text-[var(--home-heading)] sm:text-[56px]">
          {t("nav.avalonMaps")}
        </h1>
        <p className="max-w-2xl whitespace-pre-line text-base text-[var(--home-body)]">
          {t("home.subtitle")}
        </p>
      </header>

      <div className="mx-auto grid w-full max-w-6xl items-center gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,554px)_minmax(0,1fr)] md:gap-0">
        <div className="hidden md:block">
          <DecorThemedImgFill
            src="/decor/search-left.svg"
            wrapperClassName="pointer-events-none block w-[92%] -translate-y-[34px] select-none"
            imgClassName="block h-auto w-full object-contain object-left"
          />
        </div>

        <div ref={searchAreaRef} className="relative mx-auto w-full max-w-[554px]">
          <div className="pointer-events-none absolute -inset-[6px] rounded-[32px] home-search-rail" />
          <div className="group home-search-field relative h-[46px] w-full rounded-[28px]">
            <div className="pointer-events-none absolute inset-0 z-0 flex min-w-0 items-center overflow-hidden pl-5 pr-14">
              <HomeSearchTypingDemo
                active={query === "" && !searchFocused}
                className="truncate text-[22px] leading-normal text-[var(--home-input-placeholder)]"
              />
            </div>
            <input
              type="text"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onFocus={() => {
                window.clearTimeout(searchBlurTimeoutRef.current);
                setSearchFocused(true);
                setIsSearchOpen(true);
              }}
              onBlur={() => {
                window.clearTimeout(searchBlurTimeoutRef.current);
                searchBlurTimeoutRef.current = window.setTimeout(() => {
                  setSearchFocused(false);
                }, 120);
              }}
              onChange={(event) => {
                setQuery(event.target.value);
                setIsSearchOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setQuery("");
                  setIsSearchOpen(false);
                  event.currentTarget.blur();
                }
              }}
              placeholder={searchFocused || query ? t("home.searchPlaceholder") : ""}
              aria-label={t("home.searchPlaceholder")}
              className="relative z-10 h-full w-full min-h-0 rounded-[24px] bg-transparent pl-5 pr-14 text-[22px] leading-normal text-[var(--home-input-text)] caret-[var(--home-input-text)] outline-none transition-[color] duration-150 placeholder:text-[var(--home-input-placeholder)] placeholder:opacity-100 placeholder:transition-opacity placeholder:duration-200 focus:placeholder:opacity-0 focus:placeholder:text-transparent selection:bg-[var(--home-selection-bg)] selection:text-[var(--home-selection-text)]"
            />
            <Search className="pointer-events-none absolute right-3 top-1/2 z-20 size-6 -translate-y-1/2 text-[var(--home-search-icon)] transition-colors duration-150 [stroke-width:2.8] group-focus-within:text-[var(--home-search-icon-focus)]" />
          </div>
          {isSearchOpen && suggestions.length > 0 && (
            <div className="absolute left-[6px] top-[calc(100%+6px)] z-20 w-[calc(100%-12px)] overflow-hidden rounded-md border border-[var(--home-suggest-border)] bg-[var(--home-suggest-bg)] shadow-[var(--home-suggest-shadow)]">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.name}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-[var(--home-suggest-text)] hover:bg-[var(--home-suggest-hover)]"
                  onClick={() => {
                    setQuery(suggestion.name);
                    setIsSearchOpen(false);
                  }}
                >
                  <span className="truncate">{suggestion.name}</span>
                  <span className="shrink-0 rounded-md bg-[var(--home-suggest-badge-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--home-suggest-badge-text)]">
                    {toRoman(suggestion.tier)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="hidden md:block">
          <DecorThemedImgFill
            src="/decor/search-right.svg"
            wrapperClassName="pointer-events-none ml-auto block w-[92%] -translate-y-[34px] select-none"
            imgClassName="block h-auto w-full object-contain object-right"
          />
        </div>
      </div>

      <section className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {visibleMaps.map((map) => (
          <article key={map.id} className="space-y-2">
            <div className="flex justify-center">
              <h2 className="truncate text-center text-[24px] font-bold tracking-[0.01em] text-[var(--home-map-title)]">
                {map.name} {toRoman(map.tier)}
              </h2>
            </div>
            <div className="relative aspect-square bg-transparent">
              <div className="map-preview-mask absolute inset-0">
                <Image
                  src={failedImageIds.has(map.id) ? "/maps/placeholder.svg" : `/maps/${map.image}`}
                  alt={map.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="home-map-image object-cover"
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
              <div
                className="pointer-events-none absolute inset-[10px] rounded-[5px] border-[2.5px] border-[var(--home-map-frame)]"
                aria-hidden
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
        <p className="rounded-lg border border-dashed border-[var(--home-empty-border)] bg-[var(--home-empty-bg)] px-4 py-10 text-center text-sm text-[var(--home-empty-text)]">
          {t("home.notFound")}
        </p>
      )}

      <HomeNotice />
    </main>
  );
}
