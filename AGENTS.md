# Albion Prices — команда агентов

Главный агент (оркестратор) в Cursor анализирует запрос пользователя и делегирует работу специализированным агентам.

## Роли

| Агент | Skill / Rule | Зона ответственности |
|-------|--------------|----------------------|
| **Оркестратор** | `orchestrator` (always) | Маршрутизация задач, координация нескольких агентов |
| **Avalon Maps** | `page-avalon-maps` | Главная `/` — поиск карт, сетка, пагинация, превью |
| **Price Checker** | `page-price-checker` | `/price-checker` — предметы, цены по городам, таблица |
| **Crafting Calculator** | `page-crafting-calculator` | `/crafting-calculator` — калькулятор крафта (в разработке) |
| **Адаптив** | `agent-responsive` | Breakpoints, мобильная вёрстка, темы, i18n, layout |

## Маршрутизация запросов

```
Запрос пользователя
        │
        ▼
   Оркестратор
        │
   ┌────┴────┬──────────────┬─────────────────┐
   ▼         ▼              ▼                 ▼
Avalon    Price         Crafting         Адаптив
 Maps    Checker        Calculator      (параллельно
                                       при UI-задачах)
```

### Примеры

| Запрос | Агент(ы) |
|--------|----------|
| «Сделай строку поиска на Avalon Maps» | Avalon Maps |
| «Добавь сортировку по цене» | Price Checker |
| «Начни калькулятор крафта» | Crafting Calculator |
| «На мобилке таблица обрезается» | Адаптив + страница-владелец |
| «Переделай хедер и навигацию» | Адаптив (+ оркестратор при затрагивании нескольких страниц) |
| «Переведи подсказки на главной» | Avalon Maps + Адаптив (i18n) |

## Ключевые файлы

| Страница | Route | Основные файлы |
|----------|-------|----------------|
| Avalon Maps | `/` | `app/page.tsx`, `components/home-search-typing-demo.tsx`, `src/data/maps.json` |
| Price Checker | `/price-checker` | `app/price-checker/page.tsx`, `app/api/prices/route.ts`, `app/api/items/route.ts` |
| Crafting Calculator | `/crafting-calculator` | `app/crafting-calculator/page.tsx` |
| Общее | — | `app/layout.tsx`, `app/globals.css`, `components/site-header.tsx`, `components/language-provider.tsx` |

## Как вызывать агента вручную

В чате Cursor:

- `/page-avalon-maps` — задача для главной
- `/page-price-checker` — задача для проверки цен
- `/page-crafting-calculator` — задача для калькулятора
- `/agent-responsive` — задача по адаптиву

Или просто опишите задачу — оркестратор выберет агента автоматически.

## Стек

Next.js 15 · React 19 · Tailwind CSS 4 · TypeScript · App Router · `LanguageProvider` (ru/en)
