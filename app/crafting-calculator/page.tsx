"use client";

import { useLanguage } from "@/components/language-provider";

export default function CraftingCalculatorPage() {
  const { t } = useLanguage();

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        {t("nav.craftingCalculator")}
      </h1>
      <p className="rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
        {t("crafting.inProgress")}
      </p>
    </main>
  );
}
