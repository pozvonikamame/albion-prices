import {
  buildBaseSearchHaystacks,
  buildVariantSearchHaystack,
  matchesAnyHaystack,
  matchesSearchHaystack,
  normalizeSearchValue,
  rankSearchMatch,
} from "@/lib/item-search";

const ITEMS_URL =
  "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json";
const ITEMS_XML_URL =
  "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.xml";

export type Item = {
  /** Numeric index from `items.json` (game internal id). */
  id: number;
  /** Stable item identifier, e.g. `T4_BAG`. */
  uniqueName: string;
  /** English display name (fallback). */
  name: string;
  /** Russian display name from localization dump. */
  ruName: string;
  /** Name without tier prefix for cleaner UI. */
  baseName: string;
  /** Tier parsed from uniqueName (T4 => 4). */
  tier: number | null;
  /** Unique name without enchant suffix, e.g. T4_BAG. */
  baseUniqueName: string;
  /** Enchant level parsed from suffix @N. */
  enchant: number;
};

export type ItemCapabilities = {
  tiers: Array<{ tier: number; id: number }>;
  enchants: number[];
  qualities: number[];
  enchantStyle: "none" | "gear" | "resource";
};

export type ItemWithCapabilities = Item & {
  capabilities: ItemCapabilities;
};

export type ItemSearchRow = ItemWithCapabilities & {
  listEnchant: number;
};

const byUniqueName = new Map<string, Item>();
const byNumericId = new Map<number, Item>();
let allItems: Item[] = [];

const maxQualityByBase = new Map<string, number>();
const maxEnchantByBase = new Map<string, number>();
/** Max resource rarity level for base ids like T4_ROCK -> 3, T4_WOOD -> 4. */
const resourceRarityMaxByBase = new Map<string, number>();
const tierFamilyBySuffix = new Map<string, Map<number, Item>>();

const TIER_NAME_PREFIXES = [
  "Novice's ",
  "Journeyman's ",
  "Adept's ",
  "Expert's ",
  "Master's ",
  "Grandmaster's ",
  "Elder's ",
];

function parseTier(uniqueName: string): number | null {
  const match = /^T(\d+)_/.exec(uniqueName);
  if (!match) return null;
  const tier = Number.parseInt(match[1], 10);
  return Number.isFinite(tier) ? tier : null;
}

function tierSuffix(baseUniqueName: string): string | null {
  const match = /^T\d+_(.+)$/.exec(baseUniqueName);
  return match ? match[1] : null;
}

function splitEnchant(uniqueName: string): { baseUniqueName: string; enchant: number } {
  const match = /^(.*)@(\d+)$/.exec(uniqueName);
  if (!match) {
    return { baseUniqueName: uniqueName, enchant: 0 };
  }
  return {
    baseUniqueName: match[1],
    enchant: Number.parseInt(match[2], 10) || 0,
  };
}

function toBaseName(name: string, uniqueName: string): string {
  const clean = name.trim();
  if (!clean) return uniqueName;
  for (const prefix of TIER_NAME_PREFIXES) {
    if (clean.startsWith(prefix)) {
      return clean.slice(prefix.length).trim();
    }
  }
  return clean;
}

type RawItem = {
  Index?: string | number;
  UniqueName?: string;
  LocalizedNames?: Record<string, string>;
};

function toItem(raw: RawItem): Item | null {
  const uniqueName = raw.UniqueName?.trim() ?? "";
  if (!uniqueName) return null;
  const id = Number.parseInt(String(raw.Index ?? ""), 10);
  if (!Number.isFinite(id)) return null;

  const localized = raw.LocalizedNames ?? {};
  const name = localized["EN-US"]?.trim() || uniqueName;
  const ruName = localized["RU-RU"]?.trim() || "";

  const { baseUniqueName, enchant } = splitEnchant(uniqueName);
  return {
    id,
    uniqueName,
    name,
    ruName,
    baseName: toBaseName(name, uniqueName),
    tier: parseTier(baseUniqueName),
    baseUniqueName,
    enchant,
  };
}

function parseItemsJson(raw: unknown): Item[] {
  if (!Array.isArray(raw)) return [];
  const items: Item[] = [];
  for (const entry of raw) {
    const item = toItem(entry as RawItem);
    if (item && item.enchant === 0) items.push(item);
  }
  return items;
}

function indexEnchantVariants(raw: unknown): void {
  if (!Array.isArray(raw)) return;
  for (const entry of raw) {
    const uniqueName = (entry as RawItem).UniqueName?.trim() ?? "";
    const resourceMatch = /^(T\d+_\w+)_LEVEL(\d+)@(\d+)$/.exec(uniqueName);
    if (resourceMatch) continue;
    const match = /^(.*)@(\d+)$/.exec(uniqueName);
    if (!match) continue;
    const base = match[1];
    const level = Number.parseInt(match[2], 10);
    if (!Number.isFinite(level)) continue;
    maxEnchantByBase.set(base, Math.max(maxEnchantByBase.get(base) ?? 0, level));
  }
}

/** Raw/refined resources: T4_ROCK_LEVEL1@1 .. T4_ROCK_LEVEL3@3 (stone has no .4). */
function indexResourceRarity(raw: unknown): void {
  if (!Array.isArray(raw)) return;
  for (const entry of raw) {
    const uniqueName = (entry as RawItem).UniqueName?.trim() ?? "";
    const match = /^(T\d+_\w+)_LEVEL(\d+)@(\d+)$/.exec(uniqueName);
    if (!match) continue;
    const base = match[1];
    const level = Number.parseInt(match[3], 10);
    if (!Number.isFinite(level) || level < 1) continue;
    resourceRarityMaxByBase.set(
      base,
      Math.max(resourceRarityMaxByBase.get(base) ?? 0, level),
    );
  }
}

function getMaxEnchantLevel(item: Item): number {
  const gearMax = maxEnchantByBase.get(item.baseUniqueName) ?? 0;
  const resourceMax = resourceRarityMaxByBase.get(item.baseUniqueName) ?? 0;
  return Math.max(gearMax, resourceMax);
}

export function getItemMaxEnchantLevel(item: Item): number {
  return getMaxEnchantLevel(item);
}

/**
 * Map UI enchant level to Albion API item id.
 * Gear: T4_BAG@1. Resources: T4_ROCK_LEVEL1@1 (shown as .1 in UI).
 */
export function resolvePriceItemId(item: Item, enchant: number): string {
  if (enchant <= 0) return item.baseUniqueName;

  const resourceMax = resourceRarityMaxByBase.get(item.baseUniqueName) ?? 0;
  if (resourceMax > 0 && enchant <= resourceMax) {
    return `${item.baseUniqueName}_LEVEL${enchant}@${enchant}`;
  }

  const gearMax = maxEnchantByBase.get(item.baseUniqueName) ?? 0;
  if (gearMax > 0 && enchant <= gearMax) {
    return `${item.baseUniqueName}@${enchant}`;
  }

  return item.baseUniqueName;
}

function parseQualityFromXml(xml: string): void {
  const tagPattern = /uniquename="([^"]+)"([^>]*)>/g;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(xml)) !== null) {
    const uniqueName = match[1];
    const attrs = match[2];
    if (/\bcount="/.test(attrs)) continue;
    const maxQualityMatch = /maxqualitylevel="(\d+)"/.exec(attrs);
    if (!maxQualityMatch) continue;
    const maxQuality = Number.parseInt(maxQualityMatch[1], 10);
    if (!Number.isFinite(maxQuality) || maxQuality < 2) continue;
    maxQualityByBase.set(uniqueName, maxQuality);
  }
}

function indexTierFamilies(): void {
  tierFamilyBySuffix.clear();
  for (const item of allItems) {
    const suffix = tierSuffix(item.baseUniqueName);
    if (!suffix || item.tier == null) continue;
    if (!tierFamilyBySuffix.has(suffix)) {
      tierFamilyBySuffix.set(suffix, new Map());
    }
    tierFamilyBySuffix.get(suffix)!.set(item.tier, item);
  }
}

export function getItemCapabilities(item: Item): ItemCapabilities {
  const suffix = tierSuffix(item.baseUniqueName);
  const tierMap = suffix ? tierFamilyBySuffix.get(suffix) : undefined;
  const tiers = tierMap
    ? [...tierMap.entries()]
        .sort(([a], [b]) => a - b)
        .map(([tier, variant]) => ({ tier, id: variant.id }))
    : [];

  const maxEnchant = getMaxEnchantLevel(item);
  const enchants =
    maxEnchant > 0
      ? Array.from({ length: maxEnchant + 1 }, (_, index) => index)
      : [];

  const resourceMax = resourceRarityMaxByBase.get(item.baseUniqueName) ?? 0;
  const gearMax = maxEnchantByBase.get(item.baseUniqueName) ?? 0;
  const enchantStyle =
    resourceMax > 0 ? "resource" : gearMax > 0 ? "gear" : "none";

  const maxQuality = maxQualityByBase.get(item.baseUniqueName) ?? 0;
  const qualities =
    maxQuality >= 2
      ? Array.from({ length: maxQuality }, (_, index) => index + 1)
      : [];

  return { tiers, enchants, qualities, enchantStyle };
}

export function toItemWithCapabilities(item: Item): ItemWithCapabilities {
  return { ...item, capabilities: getItemCapabilities(item) };
}

async function loadItemsFromRemote(): Promise<void> {
  const [itemsRes, xmlRes] = await Promise.all([
    fetch(ITEMS_URL, { cache: "no-store" }),
    fetch(ITEMS_XML_URL, { cache: "no-store" }),
  ]);
  if (!itemsRes.ok) {
    throw new Error(`Failed to fetch items: ${itemsRes.status} ${itemsRes.statusText}`);
  }
  if (!xmlRes.ok) {
    throw new Error(`Failed to fetch items.xml: ${xmlRes.status} ${xmlRes.statusText}`);
  }

  const json = (await itemsRes.json()) as unknown;
  const xml = await xmlRes.text();

  indexEnchantVariants(json);
  indexResourceRarity(json);
  parseQualityFromXml(xml);
  allItems = parseItemsJson(json);
  byUniqueName.clear();
  byNumericId.clear();
  for (const item of allItems) {
    byUniqueName.set(item.uniqueName, item);
    byNumericId.set(item.id, item);
  }
  indexTierFamilies();
}

let itemsReady = false;
let itemsLoadPromise: Promise<void> | null = null;

/** Loads item dump on first API call instead of at module import (avoids 500 on boot/HMR). */
export async function ensureItemsReady(): Promise<void> {
  if (itemsReady) return;
  if (!itemsLoadPromise) {
    itemsLoadPromise = loadItemsFromRemote()
      .then(() => {
        itemsReady = true;
      })
      .catch((error) => {
        itemsLoadPromise = null;
        throw error;
      });
  }
  await itemsLoadPromise;
}

export function toItemSearchRow(item: Item, listEnchant: number): ItemSearchRow {
  return { ...toItemWithCapabilities(item), listEnchant };
}

/**
 * Partial search (ignores spaces/dots), subsequence matching like Avalon maps.
 * Expands enchant/rarity variants: «мрамор» → Мрамор 8.0, 8.1, 8.2 …
 */
export function searchItems(query: string): ItemSearchRow[] {
  const trimmed = query.trim();
  const q = normalizeSearchValue(trimmed);
  if (!q) return [];

  const idNum = Number.parseInt(trimmed, 10);
  if (String(idNum) === trimmed) {
    const item = byNumericId.get(idNum);
    if (item) {
      const enchants = getItemCapabilities(item).enchants;
      const levels = enchants.length > 0 ? enchants : [0];
      return levels.map((listEnchant) => toItemSearchRow(item, listEnchant));
    }
  }

  // Short queries match too many items and flood the dropdown.
  if (q.length < 2) return [];

  type RankedRow = ItemSearchRow & { rank: number };
  const matches: RankedRow[] = [];

  for (const item of allItems) {
    const capabilities = getItemCapabilities(item);
    const baseHaystacks = buildBaseSearchHaystacks(item);
    const baseMatches = matchesAnyHaystack(q, baseHaystacks);
    const levels = capabilities.enchants.length > 0 ? capabilities.enchants : [0];

    for (const listEnchant of levels) {
      const variantHaystack = buildVariantSearchHaystack(item, listEnchant);
      const variantMatches = matchesSearchHaystack(q, variantHaystack);
      if (!baseMatches && !variantMatches) continue;

      matches.push({
        ...toItemSearchRow(item, listEnchant),
        rank: rankSearchMatch(
          q,
          baseHaystacks,
          variantHaystack,
          baseMatches,
          variantMatches,
        ),
      });
    }
  }

  matches.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    const aLabel = (a.ruName || a.name || a.uniqueName).toLowerCase();
    const bLabel = (b.ruName || b.name || b.uniqueName).toLowerCase();
    if (aLabel !== bLabel) return aLabel.localeCompare(bLabel);
    if ((a.tier ?? 0) !== (b.tier ?? 0)) return (a.tier ?? 0) - (b.tier ?? 0);
    return a.listEnchant - b.listEnchant;
  });

  return matches.slice(0, 80).map((row) => {
    const { rank: _unusedRank, ...rest } = row;
    return rest;
  });
}

/** O(1) lookup by unique name (exact match, case-sensitive as in the dump). */
export function getItemByUniqueName(uniqueName: string): Item | undefined {
  return byUniqueName.get(uniqueName);
}

/** Lookup by numeric id from `items.txt`. */
export function getItemByNumericId(id: number): Item | undefined {
  return byNumericId.get(id);
}

/** All base catalog items (enchant 0). */
export function getAllCatalogItems(): Item[] {
  return allItems;
}

/** Resolve Albion price API id back to catalog item + enchant level. */
export function lookupItemByPriceId(
  priceId: string,
): { item: Item; enchant: number } | null {
  const direct = byUniqueName.get(priceId);
  if (direct) return { item: direct, enchant: 0 };

  const resourceMatch = /^(T\d+_\w+)_LEVEL(\d+)@(\d+)$/.exec(priceId);
  if (resourceMatch) {
    const base = resourceMatch[1];
    const enchant = Number.parseInt(resourceMatch[3], 10);
    const item = byUniqueName.get(base);
    if (item && Number.isFinite(enchant)) return { item, enchant };
  }

  const gearMatch = /^(.*)@(\d+)$/.exec(priceId);
  if (gearMatch) {
    const base = gearMatch[1];
    const enchant = Number.parseInt(gearMatch[2], 10);
    const item = byUniqueName.get(base);
    if (item && Number.isFinite(enchant)) return { item, enchant };
  }

  return null;
}
