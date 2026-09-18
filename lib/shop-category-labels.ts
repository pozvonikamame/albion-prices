export const SHOP_CATEGORY_LABELS: Record<
  string,
  { ru: string; en: string }
> = {
  "weapons:arcanestaff": { ru: "Мистические посохи", en: "Arcane Staffs" },
  "weapons:axe": { ru: "Топоры", en: "Axes" },
  "weapons:bow": { ru: "Луки", en: "Bows" },
  "weapons:crossbow": { ru: "Арбалеты", en: "Crossbows" },
  "weapons:cursestaff": { ru: "Проклятые посохи", en: "Cursed Staffs" },
  "weapons:dagger": { ru: "Кинжалы", en: "Daggers" },
  "weapons:firestaff": { ru: "Огненные посохи", en: "Fire Staffs" },
  "weapons:froststaff": { ru: "Ледяные посохи", en: "Frost Staffs" },
  "weapons:hammer": { ru: "Молоты", en: "Hammers" },
  "weapons:holystaff": { ru: "Священные посохи", en: "Holy Staffs" },
  "weapons:knuckles": { ru: "Кастеты", en: "Knuckles" },
  "weapons:mace": { ru: "Булавы", en: "Maces" },
  "weapons:naturestaff": { ru: "Природные посохи", en: "Nature Staffs" },
  "weapons:quarterstaff": { ru: "Боевые посохи", en: "Quarterstaves" },
  "weapons:shapeshifterstaff": {
    ru: "Посохи оборотня",
    en: "Shapeshifter Staffs",
  },
  "weapons:spear": { ru: "Копья", en: "Spears" },
  "weapons:sword": { ru: "Мечи", en: "Swords" },
  "armors:cloth_armor": { ru: "Тканевые мантии", en: "Cloth Robes" },
  "armors:leather_armor": { ru: "Кожаные доспехи", en: "Leather Armors" },
  "armors:plate_armor": { ru: "Латные доспехи", en: "Plate Armors" },
  "head:cloth_helmet": { ru: "Тканевые шлемы", en: "Cloth Helmets" },
  "head:leather_helmet": { ru: "Кожаные шлемы", en: "Leather Helmets" },
  "head:plate_helmet": { ru: "Латные шлемы", en: "Plate Helmets" },
  "shoes:cloth_shoes": { ru: "Тканевые сапоги", en: "Cloth Shoes" },
  "shoes:leather_shoes": { ru: "Кожаные сапоги", en: "Leather Shoes" },
  "shoes:plate_shoes": { ru: "Латные сапоги", en: "Plate Shoes" },
};

const CATEGORY_ORDER = [
  "weapons:bow",
  "weapons:crossbow",
  "weapons:axe",
  "weapons:dagger",
  "weapons:hammer",
  "weapons:mace",
  "weapons:knuckles",
  "weapons:quarterstaff",
  "weapons:spear",
  "weapons:sword",
  "weapons:firestaff",
  "weapons:froststaff",
  "weapons:arcanestaff",
  "weapons:cursestaff",
  "weapons:holystaff",
  "weapons:naturestaff",
  "weapons:shapeshifterstaff",
  "armors:cloth_armor",
  "armors:leather_armor",
  "armors:plate_armor",
  "head:cloth_helmet",
  "head:leather_helmet",
  "head:plate_helmet",
  "shoes:cloth_shoes",
  "shoes:leather_shoes",
  "shoes:plate_shoes",
] as const;

export function sortCategoryIds(ids: string[]): string[] {
  const order = new Map<string, number>(
    CATEGORY_ORDER.map((id, index) => [id, index]),
  );
  return [...ids].sort((a, b) => {
    const aOrder = order.get(a) ?? 999;
    const bOrder = order.get(b) ?? 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.localeCompare(b);
  });
}

export function getShopCategoryLabel(
  categoryId: string,
  language: "ru" | "en",
  fallbackRu: string,
  fallbackEn: string,
): string {
  const labels = SHOP_CATEGORY_LABELS[categoryId];
  if (!labels) return language === "ru" ? fallbackRu : fallbackEn;
  return language === "ru" ? labels.ru : labels.en;
}
