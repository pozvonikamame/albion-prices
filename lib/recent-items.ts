import type { EnchantStyle } from "@/lib/item-icon";

const STORAGE_KEY = "albion-price-recent-items-v1";
const MAX_ITEMS = 8;

export type RecentItem = {
  id: number;
  uniqueName: string;
  name: string;
  ruName: string;
  baseName: string;
  tier: number | null;
  selectedEnchant: number;
  capabilities: {
    tiers: Array<{ tier: number; id: number }>;
    enchants: number[];
    qualities: number[];
    enchantStyle: EnchantStyle;
  };
};

function isValidRecentItem(entry: unknown): entry is RecentItem {
  if (!entry || typeof entry !== "object") return false;
  const item = entry as Partial<RecentItem>;
  return (
    typeof item.id === "number" &&
    typeof item.uniqueName === "string" &&
    Boolean(item.capabilities) &&
    Array.isArray(item.capabilities?.enchants)
  );
}

function readStore(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isValidRecentItem)
      .map((item) => ({
        ...item,
        selectedEnchant: item.selectedEnchant ?? 0,
      }));
  } catch {
    return [];
  }
}

function writeStore(items: RecentItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // ignore
  }
}

export function readRecentItems(): RecentItem[] {
  return readStore();
}

export function pushRecentItem(item: RecentItem): void {
  const next = [
    item,
    ...readStore().filter(
      (entry) =>
        entry.id !== item.id || entry.selectedEnchant !== item.selectedEnchant,
    ),
  ].slice(0, MAX_ITEMS);
  writeStore(next);
}
