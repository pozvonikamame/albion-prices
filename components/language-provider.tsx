"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "ru" | "en";

type TranslationDictionary = Record<string, string>;

const translations: Record<Language, TranslationDictionary> = {
  ru: {
    "nav.avalonMaps": "Карты авалона",
    "nav.priceChecker": "Проверка цен",
    "nav.blackMarket": "Чёрный рынок",
    "nav.craftingCalculator": "Калькулятор крафта",
    "theme.switchToDark": "Переключить на темную тему",
    "theme.switchToLight": "Переключить на светлую тему",
    "lang.switchToRu": "Переключить язык на русский",
    "lang.switchToEn": "Switch language to English",
    "home.subtitle": "Поиск работает по неполным названиям. Вводи первые буквы первого слова и без пробела первые буквы второго слова. И будет тебе счастье.\nУдачи на путях авалона!",
    "home.searchPlaceholder": "Поиск...",
    "home.shownMaps": "Показано карт",
    "home.of": "из",
    "home.showMore": "Показать еще",
    "home.notFound": "По вашему запросу карты не найдены.",
    "home.notice.title": "Объявление",
    "home.notice.p1": "Добавился новый раздел чёрного рынка где можно посмотреть весь спрос. Внесены некоторые изменения на странице проверки цен, теперь интерфейс стал удобнее. Скоро продолжится работу на калькулятором.",
    "home.notice.p2": "Рекомендуйте этот сайт своим друзьям, это будет большая поддержка для разработчика :)",
    "home.notice.dismiss": "Закрыть объявление",
    "maps.foundMaps": "Найдено карт",
    "price.title": "Проверка цен",
    "price.subtitle": "Найдите предмет и посмотрите цены по городам. Дополнительные параметры появятся только для подходящих предметов.",
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
    "price.recentItems": "Недавние",
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
    "price.cachedNotice": "Часть цен взята из сохранённых данных и обновится, когда появятся свежие котировки.",
    "price.cachedRow": "(кэш)",
    "price.refreshing": "Обновление цен…",
    "price.city": "Город",
    "price.sellPriceMin": "Цена продажи (Sell Price Min)",
    "price.buyPriceMax": "Цена покупки (Buy Price Max)",
    "price.updatedAt": "Время обновления",
    "crafting.inProgress": "Страница находится в разработке.",
    "bm.title": "Чёрный рынок",
    "bm.subtitle": "Полный список заявок на выкуп чёрного рынка. Загрузка начинается автоматически; прокрутите вниз, чтобы подгрузить ещё.",
    "bm.searchPlaceholder": "Поиск по названию…",
    "bm.foundItems": "Найдено",
    "bm.of": "из",
    "bm.notFound": "По запросу ничего не найдено",
    "bm.buyPrice": "Цена выкупа",
    "bm.quality": "Качество",
    "bm.item": "Предмет",
    "bm.refresh": "Обновить",
    "bm.refreshing": "Сканирование чёрного рынка…",
    "bm.loading": "Загрузка списка…",
    "bm.cachedNotice": "Данные из кэша. Нажмите «Обновить» для актуального списка.",
    "bm.empty": "Сейчас нет активных заявок на выкуп на чёрном рынке в наших данных. Попробуйте обновить позже.",
    "bm.failedLoad": "Не удалось загрузить чёрный рынок",
    "bm.lastUpdate": "Обновлено",
    "bm.scanProgress": "Пакет",
    "bm.scanOf": "из",
    "bm.shown": "показано",
    "bm.loadMore": "Показать ещё…",
    "bm.scrollLoad": "Загрузка списка… прокрутите вниз",
  },
  en: {
    "nav.avalonMaps": "Avalon Maps",
    "nav.priceChecker": "Price Checker",
    "nav.blackMarket": "Black Market",
    "nav.craftingCalculator": "Crafting Calculator",
    "theme.switchToDark": "Switch to dark theme",
    "theme.switchToLight": "Switch to light theme",
    "lang.switchToRu": "Switch language to Russian",
    "lang.switchToEn": "Switch language to English",
    "home.subtitle": "Search supports partial names. Type the first letters of the first word and, without a space, the first letters of the second word to find matches quickly.\nGood luck on the roads of Avalon!",
    "home.searchPlaceholder": "Search...",
    "home.shownMaps": "Shown maps",
    "home.of": "of",
    "home.showMore": "Show more",
    "home.notFound": "No maps found for your query.",
    "home.notice.title": "Announcement",
    "home.notice.p1": "A new Black Market section has been added where you can see all demand. Some changes were made to the Price Checker page — the interface is now more convenient. Work on the calculator will continue soon.",
    "home.notice.p2": "Recommend this site to your friends — it's great support for the developer :)",
    "home.notice.dismiss": "Dismiss announcement",
    "maps.foundMaps": "Found maps",
    "price.title": "Albion Price Checker",
    "price.subtitle": "Find an item and compare city prices. Extra options appear only when the item supports them.",
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
    "price.recentItems": "Recent",
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
    "price.cachedNotice": "Some prices are from saved data and will update when fresh market quotes arrive.",
    "price.cachedRow": "(cached)",
    "price.refreshing": "Refreshing prices…",
    "price.city": "City",
    "price.sellPriceMin": "Sell Price Min",
    "price.buyPriceMax": "Buy Price Max",
    "price.updatedAt": "Updated at",
    "crafting.inProgress": "This page is under development.",
    "bm.title": "Black Market",
    "bm.subtitle": "Full Black Market buy order list. Loading starts automatically; scroll down to load more.",
    "bm.searchPlaceholder": "Search by name…",
    "bm.foundItems": "Found",
    "bm.of": "of",
    "bm.notFound": "Nothing found for your query",
    "bm.buyPrice": "Buy price",
    "bm.quality": "Quality",
    "bm.item": "Item",
    "bm.refresh": "Refresh",
    "bm.refreshing": "Scanning Black Market…",
    "bm.loading": "Loading list…",
    "bm.cachedNotice": "Showing cached data. Click Refresh for an up-to-date list.",
    "bm.empty": "No active Black Market buy orders in our data right now. Try refreshing later.",
    "bm.failedLoad": "Failed to load Black Market",
    "bm.lastUpdate": "Updated",
    "bm.scanProgress": "Batch",
    "bm.scanOf": "of",
    "bm.shown": "shown",
    "bm.loadMore": "Show more…",
    "bm.scrollLoad": "Loading list… scroll down",
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
