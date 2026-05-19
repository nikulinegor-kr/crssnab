## Доска (Kanban) — план реализации

Новый view для существующей сущности `requests`. Без новых таблиц для задач — работаем с теми же заявками.

### 1. Маршрут и навигация
- Новый маршрут `/board` в `src/App.tsx` (lazy-loaded `BoardPage`).
- Пункт в `AppSidebar` с иконкой `LayoutDashboard` («Доска»), разместить рядом с «Заявки».
- В `MobileBottomNav` добавить иконку для быстрого доступа.

### 2. Страница `src/pages/BoardPage.tsx`
Состав:
- Шапка: поиск, быстрые фильтры (Все / Мои / Срочные / Просроченные / Без ответа / Без поставщика), переключатель «Доска / Таблица» (ссылка на `/requests`).
- Колонки статусов:
  - Новая, В работе, Запрос КП, Ожидание ответа, Согласование, Оплачено, Доставка, Завершено.
  - Маппинг существующих русских статусов из БД (`Новая заявка`, `В работе`, `Запрос КП`, `Ожидание КП`, `На согласовании`, `Оплачено`, `В пути` / `Доставлено в ТК`, `Доставлено`) — нормализация в утилите `src/lib/boardStatuses.ts`.
- Горизонтальный скролл колонок. На мобильном — swipe + sticky фильтры.

### 3. Drag & Drop
- Библиотека `@dnd-kit/core` + `@dnd-kit/sortable` (легче `react-beautiful-dnd`, поддержка touch).
- При drop:
  - Optimistic update в React Query кеше.
  - `UPDATE requests SET status = ... WHERE id = ...`.
  - Триггер `log_request_activity` уже логирует смену статуса — отдельно ничего не пишем.

### 4. Карточка `src/components/board/BoardCard.tsx`
Компактная: описание (title), контрагент, ответственный (avatar+имя из `executor` или нового `assignee_id`), дата (`delivery_date`), бейдж приоритета, число позиций (`request_items.count`), статус оплаты, цветовая полоса слева по `priority`. Бейджи: «Срочно», «Просрочено» (delivery_date < now), «Нет поставщика».

Быстрые действия (popover на «…»): открыть заявку, копировать текст поставщику, Telegram (`https://t.me/...`), WhatsApp (`https://wa.me/...`), позвонить (`tel:`), документы.

### 5. Фильтр «Мои»
- Использовать текущего пользователя (`useAuth`), сравнивать с `executor` / `created_by` / `assignee_id`.

### 6. Realtime
- `supabase.channel('board-requests').on('postgres_changes', { table: 'requests' })` — инвалидация query на UPDATE/INSERT/DELETE.
- Включить realtime publication для `requests` (миграция: `ALTER PUBLICATION supabase_realtime ADD TABLE public.requests;` если ещё не добавлена).

### 7. Activity Log
Уже есть таблица `request_activities` + триггер. На карточке клик «История» открывает drawer с `RequestActivityFeed`.

### 8. Назначение сотрудников
Сейчас уже есть `executor` (text) и `applicant_user_id`. Для будущей гибкости — необязательная миграция: добавить `assignee_id uuid` в `requests` (NULL допустим, FK на `auth.users` нельзя — оставляем без FK, как в проекте). Пока используем `executor` для аватара через `request_participants`.

Решение: **не добавляем колонку сейчас**, чтобы не ломать формы. Используем `executor` + lookup в `request_participants` для avatar/имени. Расширение оставим как TODO.

### 9. Мобильная адаптация
- На viewport <768: одна колонка во весь экран, swipe между ними (snap scroll), sticky фильтр-bar, карточка по тапу → drawer с деталями.

### 10. Производительность
- Используем существующий `useRequests(false)` с пагинацией .range.
- `useMemo` группировка по статусам.

### Файлы
Новые:
- `src/pages/BoardPage.tsx`
- `src/components/board/BoardColumn.tsx`
- `src/components/board/BoardCard.tsx`
- `src/components/board/BoardFilters.tsx`
- `src/lib/boardStatuses.ts`

Изменения:
- `src/App.tsx` — маршрут.
- `src/components/AppSidebar.tsx` — пункт меню.
- Миграция (если нужно): `ALTER PUBLICATION supabase_realtime ADD TABLE public.requests;`.

### Зависимости
`bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

### Что НЕ делаем в этой итерации (зафиксировано в коде TODO)
- SLA-движок, KPI-дашборд по сотрудникам, отдельные роли (помощник/логист/снабженец) — добавим в следующих итерациях, как и просили («заложить основу»). Архитектура (один request, разные view) этому не мешает.
