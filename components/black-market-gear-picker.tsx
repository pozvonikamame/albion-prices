"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLanguage } from "@/components/language-provider";
import {
  filterGearPickerTree,
  type GearPickerCategory,
  type GearPickerLeaf,
  type GearPickerTree,
} from "@/lib/gear-picker-tree";
import { cn } from "@/lib/utils";

type BlackMarketGearPickerProps = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

function flattenLabels(tree: GearPickerTree | null) {
  const map = new Map<string, { ru: string; en: string }>();
  if (!tree) return map;
  for (const category of tree.categories) {
    for (const leaf of category.children) {
      map.set(leaf.id, { ru: leaf.labelRu, en: leaf.labelEn });
    }
  }
  return map;
}

export function BlackMarketGearPicker({
  selectedIds,
  onChange,
}: BlackMarketGearPickerProps) {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tree, setTree] = useState<GearPickerTree | null>(null);
  const [loading, setLoading] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const labelMap = useMemo(() => flattenLabels(tree), [tree]);

  const visibleCategories = useMemo(
    () => filterGearPickerTree(tree ?? { categories: [] }, query),
    [tree, query],
  );

  const weaponCategories = useMemo(
    () => visibleCategories.filter((category) => category.group === "weapons"),
    [visibleCategories],
  );

  const armorCategories = useMemo(
    () => visibleCategories.filter((category) => category.group === "armor"),
    [visibleCategories],
  );

  const activeCategory = useMemo(() => {
    if (visibleCategories.length === 0) return null;
    if (hoveredId) {
      const hovered = visibleCategories.find((category) => category.id === hoveredId);
      if (hovered) return hovered;
    }
    return visibleCategories[0];
  }, [visibleCategories, hoveredId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetch("/api/gear-categories")
      .then((res) => res.json())
      .then((data: GearPickerTree) => {
        if (cancelled) return;
        setTree(data);
        if (data.categories[0]) setHoveredId(data.categories[0].id);
      })
      .catch(() => {
        if (!cancelled) setTree({ categories: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (visibleCategories.length === 0) {
      setHoveredId(null);
      return;
    }
    if (!visibleCategories.some((category) => category.id === hoveredId)) {
      setHoveredId(visibleCategories[0].id);
    }
  }, [visibleCategories, hoveredId]);

  const toggleLeaf = useCallback(
    (leaf: GearPickerLeaf) => {
      const next = new Set(selectedSet);
      if (next.has(leaf.id)) next.delete(leaf.id);
      else next.add(leaf.id);
      onChange([...next]);
    },
    [onChange, selectedSet],
  );

  const removeChip = useCallback(
    (id: string) => {
      onChange(selectedIds.filter((entry) => entry !== id));
    },
    [onChange, selectedIds],
  );

  const renderCategoryButton = (category: GearPickerCategory) => (
    <li key={category.id}>
      <button
        type="button"
        className={cn(
          "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60",
          activeCategory?.id === category.id && "bg-muted/80 font-medium",
        )}
        onMouseEnter={() => setHoveredId(category.id)}
        onFocus={() => setHoveredId(category.id)}
        onClick={() => setHoveredId(category.id)}
      >
        <span className="truncate">
          {language === "ru" ? category.labelRu : category.labelEn}
        </span>
        <span className="ml-1 text-xs text-muted-foreground">
          {category.children.length}
        </span>
      </button>
    </li>
  );

  return (
    <div ref={rootRef} className="flex w-full flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={t("bm.searchItems")}
          spellCheck={false}
          className="flex h-11 w-full rounded-md border border-input bg-background py-2 pl-10 pr-10 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={() => {
            setOpen((prev) => !prev);
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          aria-label={t("bm.selectItems")}
        >
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
          />
        </button>

        {open ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-50 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
            {loading ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                {t("bm.categoriesLoading")}
              </p>
            ) : visibleCategories.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                {t("bm.notFound")}
              </p>
            ) : (
              <div className="flex max-h-[min(24rem,70vh)]">
                <div className="flex w-52 shrink-0 flex-col overflow-y-auto border-r border-border sm:w-56">
                  {weaponCategories.length > 0 ? (
                    <div>
                      <p className="sticky top-0 z-[1] border-b border-border bg-muted/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("bm.weapons")}
                      </p>
                      <ul>{weaponCategories.map(renderCategoryButton)}</ul>
                    </div>
                  ) : null}
                  {armorCategories.length > 0 ? (
                    <div>
                      <p className="sticky top-0 z-[1] border-b border-border bg-muted/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("bm.armor")}
                      </p>
                      <ul>{armorCategories.map(renderCategoryButton)}</ul>
                    </div>
                  ) : null}
                </div>

                <ul className="min-w-0 flex-1 overflow-y-auto p-1">
                  {activeCategory?.children.map((leaf) => {
                    const selected = selectedSet.has(leaf.id);
                    return (
                      <li key={leaf.id}>
                        <button
                          type="button"
                          className={cn(
                            "w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                            selected &&
                              "bg-primary/15 font-medium text-foreground",
                          )}
                          onClick={() => toggleLeaf(leaf)}
                        >
                          {language === "ru" ? leaf.labelRu : leaf.labelEn}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map((id) => {
            const labels = labelMap.get(id);
            const label =
              labels == null
                ? id
                : language === "ru"
                  ? labels.ru
                  : labels.en;
            return (
              <span
                key={id}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 py-1 pl-2.5 pr-1 text-xs text-foreground"
              >
                <span className="truncate">{label}</span>
                <button
                  type="button"
                  onClick={() => removeChip(id)}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={t("bm.removeFilter")}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
