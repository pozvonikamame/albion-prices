# Black Market: сканирование и кэш

Страница `/black-market` собирает цены чёрного рынка Albion по большому числу
батчей предметов. На Vercel серверные вызовы **stateless**: между запросами
память не сохраняется, поэтому скан выполняется пошагово, а прогресс ведёт
клиент.

## Поток данных

- `GET /api/black-market` — обычный ответ из кэша (и поиск по `?q=`).
- `?begin=1[&restart=1]` — начать скан; `restart=1` очищает строки.
- `?step=1&count=N&done=M` — выполнить до N волн, начиная с батча M; в ответе
  только **новые** строки (`incremental: true`) и `scanProgress`.
- Клиент (`app/black-market/page.tsx`) хранит прогресс в `scanDoneRef` и
  накапливает строки через `mergeRowLists` (ключ `priceItemId@quality`).

## Хранилище

- `lib/black-market-store.ts`: снапшот в `globalThis.__blackMarketSnapshot` и в
  файле.
- Каталог: `/tmp/albion-prices-cache` при `process.env.VERCEL`, иначе `./.cache`.
- Снапшот записывается **на каждом шаге**, чтобы тёплый инстанс накапливал
  строки; `cachedAt` обновляется только когда запрос реально выполнил работу
  (`result.ran`), а не по одному лишь клиентскому `done`.

## Бюджет и лимиты

- `STEP_BUDGET_MS = 45s` (под `maxDuration = 60` в API-роуте).
- `PARALLEL_BATCHES = 3`, `MAX_WAVES_PER_REQUEST = 4`; для шага API волн ≤ 3.
- Каждый `fetch` защищён `AbortController` и дедлайном; при `429` — бэкофф с
  проверкой оставшегося времени.

## Инварианты и подводные камни

- `done` приходит **от клиента**. При `done >= total` прогресс не считается
  завершённым по-настоящему, и свежесть кэша (`cachedAt`/`stale`) не продлевается.
- Источник id предметов — локальная функция `collectPriceItemIds()` в
  `lib/black-market.ts` (использует `getAllCatalogItems`), а не экспорт из
  `@/lib/items`.
- Ограничение: `/tmp` и `globalThis` — по-инстансные. Если шаги скана попадут на
  разные холодные лямбды, персистентный кэш может остаться неполным. Полное
  устранение требует общего хранилища (Vercel KV/Blob) или передачи клиентом
  накопленных строк.

## Тесты

- `npm test` (vitest). Набор: `tests/black-market.test.ts`.
- Покрыто: персистентность многошагового скана (не усекается) и отсутствие
  продления TTL при `done >= total`.
- Тест подменяет `@/lib/items`, `@/lib/black-market-store`,
  `@/lib/black-market-from-cache` и глобальный `fetch`.

## Команды

- `npm run dev` — локальный запуск (`DEV_PORT`, по умолчанию 3000)
- `npm run build` — прод-сборка
- `npm run lint` — ESLint
- `npm test` — vitest
