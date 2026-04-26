"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "ru" | "en";

type TranslationDictionary = Record<string, string>;

const translations: Record<Language, TranslationDictionary> = {
  ru: {
    "nav.avalonMaps": "Avalon Maps",
    "nav.priceChecker": "Price Checker",
    "nav.craftingCalculator": "Crafting Calculator",
    "theme.switchToDark": "Переключить на темную тему",
    "theme.switchToLight": "Переключить на светлую тему",
    "lang.switchToRu": "Переключить язык на русский",
    "lang.switchToEn": "Switch language to English",
    "home.subtitle": "Поиск по названию карты, тиру или типу ресурса.",
    "home.searchPlaceholder": "Поиск...",
    "home.shownMaps": "Показано карт",
    "home.of": "из",
    "home.showMore": "Показать еще",
    "home.notFound": "По вашему запросу карты не найдены.",
    "maps.foundMaps": "Найдено карт",
    "price.title": "Albion Price Checker",
    "price.subtitle": "Найдите предмет и посмотрите цены по городам с фильтрами tier, чар и качества.",
    "price.itemLabel": "Предмет",
    "price.tierAll": "Tier: Все",
    "price.enchantNone": "Чары: без чар",
    "price.enchant": "Чары",
    "price.qualityNormal": "Качество: Обычное (1)",
    "price.qualityGood": "Качество: Хорошее (2)",
    "price.qualityOutstanding": "Качество: Выдающееся (3)",
    "price.qualityExcellent": "Качество: Отличное (4)",
    "price.qualityMasterpiece": "Качество: Шедевр (5)",
    "price.selectItem": "Выберите предмет…",
    "price.searchByNameOrId": "Поиск по названию или ID…",
    "price.searching": "Поиск…",
    "price.typeToSearch": "Введите запрос для поиска",
    "price.nothingFound": "Ничего не найдено",
    "price.marketPrices": "Рыночные цены",
    "price.cityAll": "Город: Все",
    "price.orderDesc": "Порядок: по убыванию",
    "price.orderAsc": "Порядок: по возрастанию",
    "price.sortHint": "Сортировка: клик по заголовку столбца",
    "price.selectItemHint": "Выберите предмет выше — таблица заполнится автоматически.",
    "price.loadingFor": "Загрузка цен для",
    "price.networkError": "Ошибка сети",
    "price.failedLoad": "Не удалось загрузить цены",
    "price.noData": "Нет данных по выбранным фильтрам города/сортировки.",
    "price.city": "Город",
    "price.sellPriceMin": "Цена продажи (Sell Price Min)",
    "price.buyPriceMax": "Цена покупки (Buy Price Max)",
    "price.updatedAt": "Время обновления",
    "crafting.inProgress": "Страница находится в разработке.",
  },
  en: {
    "nav.avalonMaps": "Avalon Maps",
    "nav.priceChecker": "Price Checker",
    "nav.craftingCalculator": "Crafting Calculator",
    "theme.switchToDark": "Switch to dark theme",
    "theme.switchToLight": "Switch to light theme",
    "lang.switchToRu": "Switch language to Russian",
    "lang.switchToEn": "Switch language to English",
    "home.subtitle": "Search by map name, tier, or resource type.",
    "home.searchPlaceholder": "Search...",
    "home.shownMaps": "Shown maps",
    "home.of": "of",
    "home.showMore": "Show more",
    "home.notFound": "No maps found for your query.",
    "maps.foundMaps": "Found maps",
    "price.title": "Albion Price Checker",
    "price.subtitle": "Find an item and compare city prices with tier, enchantment, and quality filters.",
    "price.itemLabel": "Item",
    "price.tierAll": "Tier: All",
    "price.enchantNone": "Enchantment: none",
    "price.enchant": "Enchantment",
    "price.qualityNormal": "Quality: Normal (1)",
    "price.qualityGood": "Quality: Good (2)",
    "price.qualityOutstanding": "Quality: Outstanding (3)",
    "price.qualityExcellent": "Quality: Excellent (4)",
    "price.qualityMasterpiece": "Quality: Masterpiece (5)",
    "price.selectItem": "Select an item…",
    "price.searchByNameOrId": "Search by name or ID…",
    "price.searching": "Searching…",
    "price.typeToSearch": "Type to search",
    "price.nothingFound": "Nothing found",
    "price.marketPrices": "Market prices",
    "price.cityAll": "City: All",
    "price.orderDesc": "Order: descending",
    "price.orderAsc": "Order: ascending",
    "price.sortHint": "Sorting: click a table header",
    "price.selectItemHint": "Select an item above — the table will fill automatically.",
    "price.loadingFor": "Loading prices for",
    "price.networkError": "Network error",
    "price.failedLoad": "Failed to load prices",
    "price.noData": "No data for the selected city/sort filters.",
    "price.city": "City",
    "price.sellPriceMin": "Sell Price Min",
    "price.buyPriceMax": "Buy Price Max",
    "price.updatedAt": "Updated at",
    "crafting.inProgress": "This page is under development.",
  },
};

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("ru");

  useEffect(() => {
    const saved = window.localStorage.getItem("language");
    if (saved === "ru" || saved === "en") {
      setLanguage(saved);
    }
  }, []);

  const value = useMemo<LanguageContextValue>(() => {
    const t = (key: string) => translations[language][key] ?? key;
    const toggleLanguage = () => {
      setLanguage((prev) => {
        const next: Language = prev === "ru" ? "en" : "ru";
        window.localStorage.setItem("language", next);
        return next;
      });
    };
    const setAndStoreLanguage = (next: Language) => {
      setLanguage(next);
      window.localStorage.setItem("language", next);
    };
    return {
      language,
      setLanguage: setAndStoreLanguage,
      toggleLanguage,
      t,
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
