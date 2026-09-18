import { cleanItemName } from "@/lib/item-display";
import type { Item } from "@/lib/items";
import { getItemCapabilities } from "@/lib/items";
import { getItemShopMeta } from "@/lib/item-shop-meta";
import {
  getShopCategoryLabel,
  sortCategoryIds,
} from "@/lib/shop-category-labels";
import {
  matchesAnyHaystack,
  normalizeSearchValue,
} from "@/lib/item-search";

export type GearPickerLeaf = {
  id: string;
  labelRu: string;
  labelEn: string;
  searchHaystack: string;
};

export type GearPickerCategory = {
  id: string;
  group: "weapons" | "armor";
  labelRu: string;
  labelEn: string;
  searchHaystack: string;
  children: GearPickerLeaf[];
};

export type GearPickerTree = {
  categories: GearPickerCategory[];
};

const MIN_TIER = 4;
const MAX_TIER = 8;

function suffixFromBaseUniqueName(baseUniqueName: string): string | null {
  const match = /^T\d+_(.+)$/.exec(baseUniqueName);
  return match ? match[1] : null;
}

function isMarketGear(item: Item): boolean {
  const capabilities = getItemCapabilities(item);
  return capabilities.enchantStyle === "gear" || capabilities.qualities.length > 0;
}

function pickReferenceItem(current: Item | undefined, candidate: Item): Item {
  if (!current) return candidate;
  const currentTier = current.tier ?? MAX_TIER;
  const candidateTier = candidate.tier ?? MAX_TIER;
  if (candidateTier === MIN_TIER && currentTier !== MIN_TIER) return candidate;
  if (currentTier === MIN_TIER && candidateTier !== MIN_TIER) return current;
  if (candidateTier < currentTier) return candidate;
  if (candidateTier > currentTier) return current;
  return current;
}

function buildSearchHaystack(parts: string[]): string {
  return normalizeSearchValue(parts.filter(Boolean).join(" "));
}

export function buildGearPickerTree(items: Item[]): GearPickerTree {
  const buckets = new Map<
    string,
    {
      group: "weapons" | "armor";
      leaves: Map<string, Item>;
      labelRu: string;
      labelEn: string;
    }
  >();

  for (const item of items) {
    if (item.tier == null || item.tier < MIN_TIER || item.tier > MAX_TIER) {
      continue;
    }
    if (!isMarketGear(item)) continue;

    const shopMeta = getItemShopMeta(item.baseUniqueName);
    if (!shopMeta) continue;

    const suffix = suffixFromBaseUniqueName(item.baseUniqueName);
    if (!suffix) continue;

    const bucket =
      buckets.get(shopMeta.categoryId) ??
      (() => {
        const labelRu = getShopCategoryLabel(
          shopMeta.categoryId,
          "ru",
          cleanItemName(item, "ru"),
          cleanItemName(item, "en"),
        );
        const labelEn = getShopCategoryLabel(
          shopMeta.categoryId,
          "en",
          cleanItemName(item, "ru"),
          cleanItemName(item, "en"),
        );
        const next = {
          group: shopMeta.group,
          leaves: new Map<string, Item>(),
          labelRu,
          labelEn,
        };
        buckets.set(shopMeta.categoryId, next);
        return next;
      })();

    bucket.leaves.set(
      suffix,
      pickReferenceItem(bucket.leaves.get(suffix), item),
    );
  }

  const categories: GearPickerCategory[] = [];

  for (const categoryId of sortCategoryIds([...buckets.keys()])) {
    const bucket = buckets.get(categoryId);
    if (!bucket || bucket.leaves.size === 0) continue;

    const children = [...bucket.leaves.entries()]
      .sort(([, a], [, b]) =>
        cleanItemName(a, "ru").localeCompare(cleanItemName(b, "ru"), "ru"),
      )
      .map(([suffix, item]) => {
        const labelRu = cleanItemName(item, "ru");
        const labelEn = cleanItemName(item, "en");
        return {
          id: suffix,
          labelRu,
          labelEn,
          searchHaystack: buildSearchHaystack([
            suffix,
            labelRu,
            labelEn,
            bucket.labelRu,
            bucket.labelEn,
          ]),
        };
      });

    categories.push({
      id: categoryId,
      group: bucket.group,
      labelRu: bucket.labelRu,
      labelEn: bucket.labelEn,
      searchHaystack: buildSearchHaystack([
        categoryId,
        bucket.labelRu,
        bucket.labelEn,
        ...children.flatMap((child) => [child.labelRu, child.labelEn]),
      ]),
      children,
    });
  }

  return { categories };
}

export function filterGearPickerTree(
  tree: GearPickerTree,
  query: string,
): GearPickerCategory[] {
  const q = normalizeSearchValue(query.trim());
  if (!q) return tree.categories;

  return tree.categories
    .map((category) => {
      const categoryMatches = matchesAnyHaystack(q, [category.searchHaystack]);
      const children = category.children.filter((child) =>
        matchesAnyHaystack(q, [child.searchHaystack, category.searchHaystack]),
      );

      if (!categoryMatches && children.length === 0) return null;
      return {
        ...category,
        children: categoryMatches ? category.children : children,
      };
    })
    .filter((category): category is GearPickerCategory => category != null);
}

export function rowGearSuffix(baseUniqueName: string): string | null {
  return suffixFromBaseUniqueName(baseUniqueName);
}
