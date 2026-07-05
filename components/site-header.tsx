"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  match: string[];
  labelKey: string;
};

/** Замените SVG в public/icons — пути зафиксированы в разметке */
const LANG_ICON_TO_EN = "/icons/lang-en.svg";
const LANG_ICON_TO_RU = "/icons/lang-ru.svg";
const THEME_ICON_TO_LIGHT = "/icons/theme-light.svg";
const THEME_ICON_TO_DARK = "/icons/theme-dark.svg";

const navItems: NavItem[] = [
  { href: "/", match: ["/", "/avalon-maps"], labelKey: "nav.avalonMaps" },
  { href: "/price-checker", match: ["/price-checker"], labelKey: "nav.priceChecker" },
  { href: "/black-market", match: ["/black-market"], labelKey: "nav.blackMarket" },
  {
    href: "/crafting-calculator",
    match: ["/crafting-calculator"],
    labelKey: "nav.craftingCalculator",
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
    <header className="mt-3 bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-6">
        <nav className="flex flex-wrap items-center gap-2 sm:gap-4">
          {navItems.map((item) => {
            const isActive = item.match.includes(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-2 py-1 text-base text-muted-foreground transition-colors hover:text-foreground",
                  isActive && "font-bold text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={language === "ru" ? t("lang.switchToEn") : t("lang.switchToRu")}
            title={language === "ru" ? t("lang.switchToEn") : t("lang.switchToRu")}
            className={cn("site-header-toggle inline-flex items-center justify-center")}
          >
            <span className="site-header-toggle__disc">
              <img
                src={language === "ru" ? LANG_ICON_TO_EN : LANG_ICON_TO_RU}
                alt=""
                width={16}
                height={16}
                decoding="async"
                className="pointer-events-none size-4 shrink-0 select-none header-theme-icon"
                aria-hidden
              />
            </span>
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isLightTheme ? t("theme.switchToDark") : t("theme.switchToLight")}
            title={isLightTheme ? t("theme.switchToDark") : t("theme.switchToLight")}
            className={cn(
              "site-header-toggle inline-flex items-center justify-center text-[#e8e8ea]",
            )}
          >
            <span className="site-header-toggle__disc">
              <img
                src={isLightTheme ? THEME_ICON_TO_DARK : THEME_ICON_TO_LIGHT}
                alt=""
                width={16}
                height={16}
                decoding="async"
                className="pointer-events-none size-4 shrink-0 select-none header-theme-icon"
                aria-hidden
              />
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
