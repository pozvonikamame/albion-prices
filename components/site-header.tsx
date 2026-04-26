"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  match: string[];
};

const navItems: NavItem[] = [
  { href: "/", match: ["/", "/avalon-maps"] },
  { href: "/price-checker", match: ["/price-checker"] },
  {
    href: "/crafting-calculator",
    match: ["/crafting-calculator"],
  },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { language, toggleLanguage, t } = useLanguage();
  const [isLightTheme, setIsLightTheme] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const storedTheme = window.localStorage.getItem("theme");
    const shouldUseLight = storedTheme === "light";
    root.classList.toggle("light", shouldUseLight);
    setIsLightTheme(shouldUseLight);
  }, []);

  function toggleTheme() {
    const root = document.documentElement;
    const nextIsLightTheme = !isLightTheme;
    root.classList.toggle("light", nextIsLightTheme);
    window.localStorage.setItem("theme", nextIsLightTheme ? "light" : "dark");
    setIsLightTheme(nextIsLightTheme);
  }

  return (
    <header className="border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <nav className="flex flex-wrap items-center gap-2 sm:gap-4">
          {navItems.map((item) => {
            const isActive = item.match.includes(pathname);
            const labelKey =
              item.href === "/"
                ? "nav.avalonMaps"
                : item.href === "/price-checker"
                  ? "nav.priceChecker"
                  : "nav.craftingCalculator";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  isActive && "font-bold text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {t(labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleLanguage}
            aria-label={language === "ru" ? t("lang.switchToEn") : t("lang.switchToRu")}
            title={language === "ru" ? t("lang.switchToEn") : t("lang.switchToRu")}
            className="text-[11px] font-semibold"
          >
            {language.toUpperCase()}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label={isLightTheme ? t("theme.switchToDark") : t("theme.switchToLight")}
            title={isLightTheme ? t("theme.switchToDark") : t("theme.switchToLight")}
          >
            {isLightTheme ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
