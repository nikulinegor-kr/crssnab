# Модуль «Фильтрующие элементы»

Новый раздел ERP, полностью независимый от «Склада запасных частей»: своя таблица в БД, свои страницы, свои фильтры и своя логика списания и неликвида.

## Структура сайдбара (ERP)

```text
ERP
├── Склад запасных частей
├── Фильтрующие элементы   ← новое
└── Склад неликвида
```

`src/components/AppSidebar.tsx` — добавить пункт «Фильтрующие элементы» между запчастями и неликвидом, иконка `Filter` из lucide.

## База данных (миграция)

Новые таблицы в `public` со схемой:

1. `filter_elements` — каталог фильтров
   - `organization_id`, `manufacturer`, `name`, `article`, `cross_numbers text[]`,
   - `unit` (шт/л/кг…), `storage_location`, `min_stock numeric`,
   - `photo_url`, `notes`, стандартные timestamps, `created_by`.
2. `filter_element_equipment` — совместимость N:M с `equipment`
   - `filter_element_id`, `equipment_id`, unique пара.
3. `filter_element_movements` — все операции (`IN`, `WRITE_OFF`, `ADJUST`, `RETURN`)
   - `filter_element_id`, `type`, `quantity`, `equipment_id` (для WRITE_OFF),
   - `responsible_user_id`, `object_id`, `comment`, `created_by`, `created_at`.
4. `filter_element_deadstock` — неликвид фильтров
   - копия ключевых полей + `quantity`, `market_price`, `actual_sale_price`,
   - `status` (`in_stock`|`for_sale`|`sold`|`written_off`),
   - `buyer`, `sold_at`, `sale_comment`, `is_archived`.

Для каждой таблицы: `GRANT SELECT/INSERT/UPDATE/DELETE ... TO authenticated`, `GRANT ALL ... TO service_role`, `ENABLE ROW LEVEL SECURITY`, политики по `user_has_org_access(auth.uid(), organization_id)`.

Функция `public.filter_element_stock(_id uuid)` — сумма движений (`IN`/`RETURN`/`ADJUST` со знаком +, `WRITE_OFF` со знаком −). Триггер `filter_element_deadstock_auto_archive` — при `quantity <= 0` ставит `is_archived = true`, аналогично запчастям.

Бакет storage `filter-elements-photos` (public read, insert/update/delete для authenticated своей организации через префикс `{org_id}/...`).

## Хук данных

`src/hooks/useFilterElements.ts`:
- список фильтров текущей организации с совместимой техникой и остатком (через RPC `filter_element_stock`);
- фильтрация по производителю, поиску (мультислово), выбранной единице техники (`equipment_id` → только фильтры, у которых есть строка в `filter_element_equipment`);
- индикатор «ниже минимума» (`stock <= min_stock`).

## Страницы и компоненты

`src/pages/FilterElements.tsx` — две вкладки:

1. **Каталог**
   - Тулбар: поиск, селектор производителя, селектор совместимой техники, чекбокс «Ниже минимума».
   - Таблица колонок ровно по ТЗ: Производитель, Наименование, Артикул, Кросс-номер (chips), Совместимость (chips, +N), Остаток, Мин. остаток, Ед. изм., Место хранения, Действия.
   - Действия: «Пополнить» (IN), «Списать», «Редактировать», «В неликвид», «Удалить».
2. **Неликвид фильтров** — таблица `filter_element_deadstock` с колонками ТЗ и кнопкой «Продать».

Диалоги (`src/components/filter-elements/`):
- `FilterElementFormDialog.tsx` — создание/редактирование с мульти-селектом техники из `equipment` (поиск по 2+ словам, как в остальном проекте).
- `FilterElementMovementDialog.tsx` — «Пополнить» / «Корректировка».
- `FilterElementWriteOffDialog.tsx` — списание: обязательные поля «Техника» (из совместимости этого фильтра), «Ответственный» (профили организации), «Объект» (`request_objects`), «Количество» (≤ остатка), «Комментарий».
- `FilterElementDetailDialog.tsx` — история движений с фильтром по типу.
- `FilterDeadstockSaleDialog.tsx` — продажа: покупатель, дата, количество, фактическая стоимость, комментарий; статус → `sold`, `quantity -= sold`.

## Роутинг

`src/App.tsx` — маршрут `/filter-elements` → `FilterElements.tsx`, обёрнут в существующий `RequireAuth` / layout как соседние ERP-страницы.

## Что НЕ меняется

- Существующие `spare_parts*` таблицы и страницы остаются нетронутыми — фильтры полностью отдельная сущность.
- «Склад неликвида» остаётся как есть; неликвид фильтров живёт внутри модуля «Фильтрующие элементы» на второй вкладке.

## Технические детали

- Manrope, tabular-nums для чисел, «—» для пустых значений, drawer 90dvh на мобиле — по правилам проекта.
- Совместимость и кросс-номера рендерятся как `Badge` с ограничением видимости (`+N` при переполнении).
- Все запросы к таблицам > 1000 строк — через `.range()` цикл (правило проекта).
- Пагинация/поиск по технике в селекторе — `Command` popover с дебаунсом 300 мс.
- Списание проводится атомарно: insert в `filter_element_movements` с типом `WRITE_OFF`; остаток пересчитывается функцией.

После утверждения плана: миграция → регенерация типов → фронтенд-код → добавление пункта в сайдбар.
