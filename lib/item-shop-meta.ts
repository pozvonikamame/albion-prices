const GEAR_SHOP_CATEGORIES = new Set([
  "weapons",
  "armors",
  "head",
  "shoes",
  "cape",
]);

export type ItemShopMeta = {
  shopCategory: string;
  shopSub1: string;
  categoryId: string;
  group: "weapons" | "armor";
};

const shopMetaByBase = new Map<string, ItemShopMeta>();

function splitEnchant(uniqueName: string): string {
  const match = /^(.*)@\d+$/.exec(uniqueName);
  return match ? match[1] : uniqueName;
}

export function ingestShopMetaFromXml(xml: string): void {
  shopMetaByBase.clear();
  const tagPattern = /<(?:weapon|equipmentitem)\s+([^>]+)>/g;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(xml)) !== null) {
    const attrs = match[1];
    const uniqueName = /uniquename="([^"]+)"/.exec(attrs)?.[1];
    const shopCategory = /shopcategory="([^"]+)"/.exec(attrs)?.[1];
    const shopSub1 = /shopsubcategory1="([^"]+)"/.exec(attrs)?.[1];
    const maxQuality = /maxqualitylevel="(\d+)"/.exec(attrs)?.[1];

    if (!uniqueName || !shopCategory || !shopSub1) continue;
    if (!GEAR_SHOP_CATEGORIES.has(shopCategory)) continue;
    if (!maxQuality || Number.parseInt(maxQuality, 10) < 2) continue;
    if (shopSub1 === "other") continue;
    if (uniqueName.startsWith("UNIQUE_")) continue;

    const baseUniqueName = splitEnchant(uniqueName);
    const group = shopCategory === "weapons" ? "weapons" : "armor";
    const categoryId = `${shopCategory}:${shopSub1}`;

    if (!shopMetaByBase.has(baseUniqueName)) {
      shopMetaByBase.set(baseUniqueName, {
        shopCategory,
        shopSub1,
        categoryId,
        group,
      });
    }
  }
}

export function getItemShopMeta(baseUniqueName: string): ItemShopMeta | undefined {
  return shopMetaByBase.get(baseUniqueName);
}
