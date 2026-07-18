
# Модуль «Склад запасных частей»

Разрабатываем полноценный модуль учёта запчастей с привязкой к технике, отдельный раздел неликвида, историю движения, списание, продажу и аналитику. Существующий `spare_parts` (страница `SpareParts.tsx`) переработаем/расширим под новую модель, а `deadstock_items` используем как основу для неликвида запчастей.

## 1. Разделы в боковом меню (группа ERP)

- «Склад запчастей» → `/spare-parts`
- «Неликвид запчастей» → `/spare-parts/deadstock`
- Обе страницы с адаптивной таблицей, быстрыми фильтрами слева/сверху, кнопкой «+ Добавить».

## 2. Схема БД (миграция)

Новые таблицы (public, с GRANT + RLS через `user_has_org_access`):

```text
spare_parts
  id, organization_id, name, article, manufacturer, category,
  unit, min_stock, storage_location, rack, shelf, cell,
  purchase_price, avg_cost, last_receipt_at, note,
  photos text[], is_archived, created_at, updated_at
  (текущую таблицу spare_parts проверим и расширим ALTER-ами; фото уже поле photo_url — добавим photos text[])

spare_part_cross_numbers
  id, spare_part_id, cross_number
  (или text[] cross_numbers на самой карточке — проще: text[])
  Решение: cross_numbers text[] в spare_parts.

spare_part_equipment  (совместимость N:N)
  id, spare_part_id, equipment_id, created_at
  UNIQUE(spare_part_id, equipment_id)

spare_part_movements  (единая история)
  id, organization_id, spare_part_id, type
    ('IN','WRITE_OFF','MOVE','SALE','RETURN','ADJUST'),
  quantity, equipment_id, object_id, responsible_user_id,
  reason, comment, unit_price, buyer, created_by, created_at

spare_part_deadstock
  id, organization_id, name, article, cross_numbers text[],
  manufacturer, quantity, reason, market_price, min_sale_price,
  sale_price, sold_at, buyer, comment, photos text[],
  is_archived, created_at, updated_at
  (используем существующую deadstock_items если совпадает по полям — да, у неё уже есть sold_at/buyer/invoice_number; создадим отдельно во избежание пересечений с деловым неликвидом)
```

Остаток вычисляется как сумма движений (`IN + RETURN - WRITE_OFF - SALE ± ADJUST`) через view/RPC `get_spare_part_stock(spare_part_id)`; поле `last_receipt_at` обновляется триггером при `type='IN'`.

RLS: все таблицы ограничены `user_has_org_access(auth.uid(), organization_id)`. Storage bucket `spare-parts-photos` (private, signed URLs через существующий `SignedImage`).

## 3. Фронтенд

Новые файлы:

- `src/pages/SparePartsPage.tsx` — таблица + фильтры + модалка карточки.
- `src/pages/SparePartsDeadstockPage.tsx` — таблица неликвида запчастей.
- `src/pages/SparePartDetailPage.tsx` — карточка детали: инфо, фото, совместимость (мульти-селект техники), история движения (вкладки).
- `src/components/spare-parts/`
  - `SparePartFormDialog.tsx` — создать/редактировать (все поля из ТЗ, мульти-фото загрузка, cross-numbers как теги, совместимость через `EquipmentMultiSelect`).
  - `EquipmentMultiSelect.tsx` — поиск+чекбоксы по `equipment` (по марка/модель/гос.номер).
  - `WriteOffDialog.tsx` — списание (техника из списка совместимости, объект, ответственный, кол-во, причина, комментарий).
  - `SaleDialog.tsx` — продажа неликвида (покупатель, дата, кол-во, цена, комментарий); при остаток=0 → `is_archived=true`.
  - `MovementHistoryTable.tsx` — журнал движения детали.
  - `SparePartFilters.tsx` — быстрые фильтры (производитель, модель техники, категория, место хранения, наличие: >min / ≤min / =0, совместимость с конкретной единицей техники).
  - `StockStatusBadge.tsx` — «В наличии / Заканчивается / Нет».
- `src/hooks/useSpareParts.ts`, `useSparePartMovements.ts`, `useSparePartCompatibility.ts`.
- Расширение `src/pages/EquipmentDetailPage.tsx` — секция «Подходящие запчасти» (список через join `spare_part_equipment`).

## 4. Интеграция с заявками

В `CreateRequestDialog` / `RequestItemsSection` при выборе позиции добавляется проверка `spare_parts` по артикулу/названию:

- если найдено с остатком > 0 → блок «На складе N шт., место X» + кнопка «Списать со склада» (открывает `WriteOffDialog` с привязкой к текущей заявке и `object_id`);
- если нет — стандартный флоу закупки.

Компонент `SparePartAvailability` показывается в `RequestItemsSection`.

## 5. Глобальный поиск

Расширить `GlobalSearch.tsx` — искать в `spare_parts` (name, article, cross_numbers, manufacturer) и по совместимой технике (join с equipment); чипы с переходом в `SparePartDetailPage`.

## 6. Аналитика

В `ErpAnalyticsPage` (или новая вкладка `SparePartsAnalytics`):

- Общая стоимость склада (`Σ остаток × avg_cost`).
- Стоимость неликвида.
- Кол-во позиций, кол-во ниже min_stock.
- Топ-10 самых часто списываемых (агрегат по movements WRITE_OFF).
- Топ-10 самых дорогих.
- Без движения > 180 дней (`max(created_at) < now() - 180d` в movements).
- Продано неликвида за период (с фильтром дат).

## 7. Роуты и меню

- `App.tsx`: добавить `/spare-parts`, `/spare-parts/:id`, `/spare-parts/deadstock` под `PermissionRoute`.
- `AppSidebar.tsx`: в группе ERP заменить/добавить пункты «Склад запчастей» и «Неликвид запчастей».
- Права: новый ключ `spare_parts` в `useUserPermissions`/`ROUTE_PERMISSION_MAP`.

## 8. UX-принципы

- Manrope, tabular-nums, mobile-first Drawer 90dvh на мобилке для карточек.
- Быстрый поиск (300 мс debounce) по артикулу/кросс/названию/технике — фокус по `/` и автофокус на открытии.
- Место хранения показываем компактно `A-3-2` (стеллаж-полка-ячейка) с тултипом.
- Значки статуса остатка: зелёный/жёлтый/красный.
- Фото — превью 40×40 в таблице, галерея в карточке (`ImageGallery`+`SignedImage`).

## Технические детали

- Миграция одним вызовом `supabase--migration`: create tables, grants, RLS policies, триггеры (`update_updated_at`, `update_last_receipt_at`), RPC `spare_part_stock(uuid)`.
- Bucket `spare-parts-photos` (private) через `supabase--storage_create_bucket` + policies (auth users same-org).
- Все запросы через TanStack Query с ключами `['spare-parts', orgId, filters]`.
- Пагинация >1000 через `.range()`-цикл (см. правило Supabase Pagination Resilience).

## Порядок работ

1. Миграция БД + bucket.
2. Хуки + типы.
3. Страница списка + фильтры + карточка формы.
4. Детальная страница + совместимость + история.
5. Списание + Продажа.
6. Неликвид (отдельный роут и таблица).
7. Интеграция с EquipmentDetail + CreateRequest.
8. Глобальный поиск + аналитика.
9. Sidebar/роуты/права.

Объём большой — предлагаю утвердить план и делать поэтапно, начиная с миграции и базовых экранов (шаги 1–4).
