import { buildGearPickerTree } from "@/lib/gear-picker-tree";
import { ensureItemsReady, getAllCatalogItems } from "@/lib/items";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await ensureItemsReady();
    return NextResponse.json(buildGearPickerTree(getAllCatalogItems()));
  } catch {
    return NextResponse.json(
      { error: "Gear categories unavailable" },
      { status: 503 },
    );
  }
}
