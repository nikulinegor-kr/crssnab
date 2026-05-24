
# Production-режим уведомлений

Перевожу систему из тестовой в рабочую: один rule-based маршрутизатор, очередь с ретраями, авто-триггеры на реальные события CRM, dashboard и журнал реальных отправок.

## 1. База данных (одна миграция)

**`notification_settings`** — глобальный переключатель на организацию
- `organization_id` (PK), `mode` (`test` | `production`), `dedup_window_seconds` (default 30), `max_per_minute` (default 30), `updated_at`, `updated_by`

**`notification_routing_rules`** — правила «событие → группы»
- `organization_id`, `event_type` (text), `notification_type` (`request`/`invoice`/`supply`/`alert`), `is_enabled`
- Уникальность: `(organization_id, event_type)`. Это даёт UI «IF event = X → группы типа Y» (группы уже привязаны к типу).
- Сидируем дефолтами при включении production.

**`notification_queue`** — единая очередь для MAX и Telegram
- `id`, `organization_id`, `event_type`, `entity_type`, `entity_id`, `platform` (`max`/`telegram`), `group_id`, `group_name`, `payload jsonb` (текст, метаданные), `status` (`queued`/`sending`/`delivered`/`failed`), `retry_count` (0..3), `next_attempt_at`, `last_error`, `dedup_key`, `created_at`, `sent_at`
- Индексы: `(status, next_attempt_at)`, `(organization_id, created_at desc)`, `dedup_key`.

**`notification_dedup`** — анти-спам ключи
- `dedup_key` (PK), `organization_id`, `expires_at`. Чистится по `expires_at`.

**`notification_health`** — снепшоты для дашборда
- `organization_id`, `component` (`max_api`/`telegram_api`/`max_webhook`/`telegram_webhook`/`edge_functions`), `status` (`ok`/`degraded`/`down`), `last_check_at`, `last_error`.

**RLS** — всё org-scoped через `user_has_org_access` / `user_is_org_admin`. Очередь read-only для admin, write — только service role из edge-функций.

## 2. Edge functions

**`notify-dispatch`** (новая, основная) — принимает событие, применяет routing, формирует записи в `notification_queue` (status=`queued`), дедуплицирует.
- Вход: `{ organization_id, event_type, payload }`.
- Возвращает: `{ queued: N, deduped: M, rule_matched: true/false }`.
- Уважает `notification_settings.mode`: в `test` — пишет в queue со статусом `queued` но не отправляет (виден в журнале как «test mode»); в `production` — сразу пытается отправить через worker.

**`notification-worker`** (новая) — обрабатывает очередь.
- Берёт пачку `queued`/`failed` с `next_attempt_at <= now()`, помечает `sending`, шлёт через `notify-max` или Telegram API, обновляет статус.
- Retry: 3 попытки, backoff 30s → 2m → 10m.
- Вызывается двумя путями: (a) сразу после `notify-dispatch` (fire-and-forget); (b) cron каждые 60 секунд для добивания `failed`/застрявших.

**`notification-health`** (новая) — пингует MAX (`/me`) и Telegram (`getMe`), обновляет `notification_health`. Cron каждые 5 минут.

**Существующие edge-функции** (`notify-telegram`, `notify-max`, `max-direct-send`, `telegram-debug-send`) — оставляем как есть для ручных тестов; production-путь теперь через `notify-dispatch` → queue → `notification-worker`.

## 3. Авто-триггеры CRM (DB-уровень)

Postgres-триггеры, вызывают `pg_net.http_post` к `notify-dispatch` (асинхронно):

- `requests` AFTER INSERT → event `request.created`
- `requests` AFTER UPDATE OF `status` → `request.status_changed`
- `requests` AFTER UPDATE OF `executor` → `request.executor_assigned`
- `requests` AFTER UPDATE OF `payment_status` → `request.payment_changed`, при просрочке — `invoice.overdue`
- `requests` AFTER UPDATE OF `invoice_number` (was NULL → set) → `invoice.created`
- `requests` AFTER UPDATE OF `status = 'Доставлено'` → `supply.arrived`
- `requests` AFTER UPDATE OF `photo_url`/`document_url` (NULL → set) → `supply.attachment_added`
- `request_comments` AFTER INSERT → `request.comment_added`
- `stock_movements` AFTER INSERT WHERE type IN ('MOVE_IN','MOVE_OUT') → `supply.cargo_moved`

Триггеры проверяют `notification_settings.mode = 'production'` — если `test`, не дёргают dispatch (или дёргают с пометкой simulate).

Системные ошибки (`alert.system_error`, `alert.webhook_error`) — отправляются из самих edge-функций при поимке исключений / non-2xx ответов webhook.

## 4. Routing Engine

Простая таблица rules: для `event_type` берём `notification_type`, дальше из `max_groups`/`telegram_groups` все активные группы этого типа. Дефолты при включении production:

```
request.created          → request
request.status_changed   → request
request.comment_added    → request
request.executor_assigned→ request
invoice.created          → invoice
invoice.overdue          → invoice
supply.arrived           → supply
supply.cargo_moved       → supply
supply.attachment_added  → supply
alert.system_error       → alert
alert.webhook_error      → alert
```

UI позволяет переопределять `notification_type` для любого `event_type` и отключать события.

## 5. Защита

- **Dedup**: ключ `org:event_type:entity_id:status_hash`, окно `dedup_window_seconds` (по умолчанию 30s) — повторное событие в окне не ставится в очередь.
- **Throttling**: на уровне worker — не более `max_per_minute` отправок на платформу/org.
- **Анти-цикл**: webhook-функции (`telegram-webhook`, `max-webhook`) НЕ дёргают `notify-dispatch` для собственных bot-сообщений (фильтр `is_bot` / `from.id == botId`).

> Полноценный rate-limit на бэке не вводим (см. ограничения платформы) — оставляем только мягкий throttle внутри worker.

## 6. UI

Все ниже — внутри уже существующей вкладки **Настройки → Уведомления**, добавляем подразделы.

**Глобальный переключатель** (вверху вкладки):
- Большой свитч `Тестовый ↔ Production` с предупреждением: «В Production режиме CRM шлёт реальные сообщения по событиям без подтверждения».
- Health-индикаторы рядом: MAX API · Telegram API · Webhook · Edge functions (цветные точки из `notification_health`).

**Routing Rules** (новая карточка):
- Таблица всех `event_type` с селектором типа группы и чекбоксом enable.
- Превью: какие реальные группы получат сообщение (из `max_groups`/`telegram_groups` этого типа).

**Live Monitoring** (новая карточка):
- За последние 24 часа: отправлено / в очереди / ошибок (счётчики + sparkline по часам).
- Топ-5 типов событий, топ ошибок.
- Realtime подписка на `notification_queue`.

**Журнал «Реальные отправки»**:
- Таблица из `notification_queue` (фильтры: status, platform, event_type, дата).
- Колонки: время, событие, источник (entity_type/id с линком), платформа, группа, текст (truncate), HTTP, ответ API, время доставки, retry_count.
- Действия: «Повторить отправку» (сбрасывает status→`queued`, retry_count→0), «Открыть payload».

**Health-check** (карточка):
- Кнопка «Проверить сейчас» вызывает `notification-health`.
- Показывает последний `last_check_at` и `last_error` по каждому компоненту.

## 7. Что меняется в существующем коде

- `notify-telegram` и client-side вызовы из форм заявок: оставляем для совместимости, но в production-режиме событие также пойдёт через триггер → dispatch. Чтобы не задвоить — фронтовые ручные вызовы помечают payload `source: 'manual'`, dispatch учитывает в dedup_key.
- `NotificationScenarioTester` остаётся для проверки шаблонов в обоих режимах.
- `MaxRoutingSchema` уже показывает логику — добавим линк «Открыть Routing Rules».

## 8. Технические детали

- pg_net требуется для http_post из триггеров — проверю наличие, при необходимости включу расширением.
- Cron через `pg_cron` (уже используется в проекте для archive-tasks): `notification-worker` каждую минуту, `notification-health` каждые 5 минут.
- Worker batch = 20, lock через `FOR UPDATE SKIP LOCKED`.
- Все edge-функции возвращают JSON с CORS-заголовками, ошибки логируют в `max_webhook_logs`/`telegram_webhook_logs` + `alert.system_error` в очередь.

## Порядок реализации

1. Миграция (таблицы, RLS, дефолтные routing rules, pg_net, pg_cron jobs).
2. Edge functions: `notify-dispatch`, `notification-worker`, `notification-health`.
3. DB-триггеры на `requests`, `request_comments`, `stock_movements`.
4. UI: переключатель режима, Routing Rules, Live Monitoring, Журнал, Health.
5. Обновить мемори (production routing + queue model).

---

Одно решение нужно от вас: **дефолтный режим после миграции — `test` или `production`?** По умолчанию ставлю `test`, чтобы вы вручную переключили после проверки. Скажите «production по умолчанию», если хотите сразу боевой.
