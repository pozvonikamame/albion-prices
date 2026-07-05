import { latinNameToCyrillicSearchString } from "@/src/lib/latin-to-cyrillic-search";

/** Russian tier words in parentheses, e.g. «Сумка (знаток)». */
const RU_TIER_SUFFIX =
  / \((?:новичок|странник|знаток|эксперт|мастер|магистр|старейшина)(?:;[^)]*)?\)$/iu;

type ItemSearchFields = {
  ruName: string;
  baseName: string;
  name: string;
  uniqueName: string;
  baseUniqueName: string;
  tier: number | null;
};

function cleanRuItemName(item: ItemSearchFields): string {
  if (item.ruName.trim()) {
    return item.ruName.trim().replace(RU_TIER_SUFFIX, "").trim();
  }
  return item.baseName.trim() || item.name.trim() || item.uniqueName;
}

export function normalizeSearchValue(value: string): string {
  return value.toLowerCase().replace(/[\s.\-_]+/g, "");
}

export function isSubsequenceMatch(query: string, candidate: string): boolean {
  let queryIndex = 0;
  for (let i = 0; i < candidate.length && queryIndex < query.length; i += 1) {
    if (candidate[i] === query[queryIndex]) {
      queryIndex += 1;
    }
  }
  return queryIndex === query.length;
}

export function matchesSearchHaystack(query: string, haystack: string): boolean {
  if (!haystack) return false;
  if (haystack.includes(query)) return true;
  return isSubsequenceMatch(query, haystack);
}

export function matchesAnyHaystack(query: string, haystacks: string[]): boolean {
  for (const haystack of haystacks) {
    if (matchesSearchHaystack(query, haystack)) return true;
  }
  return false;
}

function uniqueHaystacks(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

/** Search keys from display names and internal ids (spaces/dots stripped). */
export function buildBaseSearchHaystacks(item: ItemSearchFields): string[] {
  const ru = cleanRuItemName(item);
  const en = item.baseName.trim() || item.name.trim();
  return uniqueHaystacks([
    normalizeSearchValue(ru),
    normalizeSearchValue(en),
    normalizeSearchValue(latinNameToCyrillicSearchString(en)),
    normalizeSearchValue(item.baseUniqueName),
    normalizeSearchValue(item.uniqueName),
  ]);
}

/** «Мрамор 8.1» → «мрамор81» for partial tier.enchant queries. */
export function buildVariantSearchHaystack(
  item: ItemSearchFields,
  enchant: number,
): string {
  const name = normalizeSearchValue(cleanRuItemName(item));
  if (item.tier == null) return name;
  const tierEnchant =
    enchant > 0 ? `${item.tier}${enchant}` : `${item.tier}0`;
  return name + normalizeSearchValue(tierEnchant);
}

export function rankSearchMatch(
  query: string,
  baseHaystacks: string[],
  variantHaystack: string,
  baseMatches: boolean,
  variantMatches: boolean,
): number {
  if (variantHaystack.startsWith(query) || variantHaystack.includes(query)) {
    return 0;
  }
  for (const haystack of baseHaystacks) {
    if (haystack.startsWith(query)) return 1;
  }
  if (baseMatches || variantMatches) return 2;
  return 3;
}
