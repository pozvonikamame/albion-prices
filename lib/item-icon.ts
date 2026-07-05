const RENDER_BASE = "https://render.albiononline.com/v1/item";

export type EnchantStyle = "none" | "gear" | "resource";

export function resolveItemIconId(
  baseUniqueName: string,
  enchant: number,
  enchantStyle: EnchantStyle,
): string {
  if (enchant <= 0) return baseUniqueName;
  if (enchantStyle === "resource") {
    return `${baseUniqueName}_LEVEL${enchant}@${enchant}`;
  }
  if (enchantStyle === "gear") {
    return `${baseUniqueName}@${enchant}`;
  }
  return baseUniqueName;
}

export function getItemIconUrl(
  itemId: string,
  options?: { quality?: number; size?: number },
): string {
  const params = new URLSearchParams();
  if (options?.size) params.set("size", String(options.size));
  if (options?.quality && options.quality > 1) {
    params.set("quality", String(options.quality));
  }
  const qs = params.toString();
  return `${RENDER_BASE}/${encodeURIComponent(itemId)}.png${qs ? `?${qs}` : ""}`;
}
