import type { Language } from "@/components/language-provider";

/** Russian tier words in parentheses, e.g. «Сумка (знаток)». */
const RU_TIER_SUFFIX =
  / \((?:новичок|странник|знаток|эксперт|мастер|магистр|старейшина)(?:;[^)]*)?\)$/iu;

type ItemNameFields = {
  uniqueName: string;
  name: string;
  ruName: string;
  baseName: string;
  tier: number | null;
};

export function cleanRuItemName(item: ItemNameFields): string {
  if (item.ruName.trim()) {
    return item.ruName.trim().replace(RU_TIER_SUFFIX, "").trim();
  }
  return item.baseName.trim() || item.name.trim() || item.uniqueName;
}

export function cleanItemName(item: ItemNameFields, language: Language): string {
  if (language === "ru" && item.ruName.trim()) {
    return cleanRuItemName(item);
  }
  return item.baseName.trim() || item.name.trim() || item.uniqueName;
}

export function formatTierEnchant(
  tier: number | null,
  enchant = 0,
): string | null {
  if (tier == null) return null;
  return enchant > 0 ? `${tier}.${enchant}` : `${tier}.0`;
}

/** Albion-style label: «Сумка 4.0», «Сумка 6.1». */
export function formatItemLabel(
  item: ItemNameFields,
  language: Language,
  enchant = 0,
): string {
  const name = cleanItemName(item, language);
  const tierTag = formatTierEnchant(item.tier, enchant);
  if (tierTag) return `${name} ${tierTag}`;
  return name;
}
