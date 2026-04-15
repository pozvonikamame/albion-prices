const ITEMS_URL =
  "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json";

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

const byUniqueName = new Map<string, Item>();
const byNumericId = new Map<number, Item>();
let allItems: Item[] = [];

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

async function loadItemsFromRemote(): Promise<void> {
  const res = await fetch(ITEMS_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch items: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as unknown;
  allItems = parseItemsJson(json);
  byUniqueName.clear();
  byNumericId.clear();
  for (const item of allItems) {
    byUniqueName.set(item.uniqueName, item);
    byNumericId.set(item.id, item);
  }
}

await loadItemsFromRemote();

/**
 * Case-insensitive substring search over display `name`, `uniqueName`, and exact numeric `id`.
 */
export function searchItems(query: string): Item[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const matches: Item[] = [];
  for (const item of allItems) {
    const nameLower = item.name.toLowerCase();
    const ruNameLower = item.ruName.toLowerCase();
    const baseNameLower = item.baseName.toLowerCase();
    const uniqueLower = item.uniqueName.toLowerCase();
    const baseUniqueLower = item.baseUniqueName.toLowerCase();
    const idStr = String(item.id);
    if (
      nameLower.includes(q) ||
      ruNameLower.includes(q) ||
      baseNameLower.includes(q) ||
      uniqueLower.includes(q) ||
      baseUniqueLower.includes(q) ||
      idStr === query.trim()
    ) {
      matches.push(item);
    }
  }

  matches.sort((a, b) => {
    const aKey = (a.name || a.uniqueName).toLowerCase();
    const bKey = (b.name || b.uniqueName).toLowerCase();
    const aStarts = aKey.startsWith(q) ? 0 : 1;
    const bStarts = bKey.startsWith(q) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return aKey.localeCompare(bKey);
  });

  return matches;
}

/** O(1) lookup by unique name (exact match, case-sensitive as in the dump). */
export function getItemByUniqueName(uniqueName: string): Item | undefined {
  return byUniqueName.get(uniqueName);
}

/** Lookup by numeric id from `items.txt`. */
export function getItemByNumericId(id: number): Item | undefined {
  return byNumericId.get(id);
}
