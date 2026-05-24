# Маршрутизация входящих заявок с inline-кнопками

## Что добавляем

1. **Новый статус** `Входящая заявка` (становится дефолтным для новых заявок).
2. **Уведомление с inline-кнопками** «Назначить исполнителя» в группу `СахаРесурс | Входящие заявки` (MAX `-75086536078021`, Telegram аналогично).
3. **Callback `request_assign_executor`** на оба мессенджера: пишет `executor`, переводит статус в `Новая заявка`, рассылает в `Поставка ТМЦ` (`-75086506652357`).
4. **Realtime-обновление** в CRM (через existing Supabase realtime — статус и executor меняются триггером).
5. **Защита** от повторного назначения + **audit log**.

## Архитектура

```text
INSERT requests (status='Входящая заявка')
        │
        ▼
notify_request_event() trigger
        │
        ▼
enqueue_notification('request.incoming', payload={buttons:[…executors]})
        │
        ▼
notification-worker
   ├─ MAX:      POST /messages?chat_id=… attachments=[inline_keyboard]
   └─ Telegram: sendMessage reply_markup=inline_keyboard
        │  (сохраняем message_id + chat_id в notification_queue.response)
        ▼
Пользователь жмёт кнопку
        │
        ├─ Telegram → /telegram-webhook (callback_query)
        └─ MAX      → /max-webhook (message_callback)
        │
        ▼
edge function `assign-executor`:
   1. lock через UPDATE … WHERE executor IS NULL RETURNING *
      └─ если 0 строк → answer "Исполнитель уже выбран"
   2. UPDATE requests SET executor=…, status='Новая заявка'
   3. log_audit_event('executor_assigned_via_chat', old/new)
   4. editMessageText / deleteInlineKeyboard в исходной группе:
      "✅ Исполнитель назначен: {executor}"
   5. триггер notify_request_event сам поставит в очередь
      'request.status_changed' → routing → группа «Поставка ТМЦ»
```

## Изменения по слоям

### БД (migration)

- Добавить в `notification_routing_rules` seed:
  - `request.incoming` → `notification_type='incoming'`
- Новый `notification_type` `incoming` для `max_groups`/`telegram_groups` (UI селектор пополнить).
- `notify_request_event()`:
  - при `INSERT` если `NEW.status = 'Входящая заявка'` → событие `request.incoming` с payload `{buttons: executors[]}` и **не** слать `request.created` (или отфильтровать в роутинге).
  - оставшаяся логика без изменений; переход в `Новая заявка` уже даст `request.status_changed` → группа «Поставка ТМЦ» (для неё в БД должен быть routing `request.status_changed` → `notification_type='request'`).
- Новая функция `build_incoming_message(r)` — формат из ТЗ.
- Новая функция `build_assigned_message(r)` — короткий формат после назначения (п. 5).
- `notification_queue`: добавить колонки `provider_message_id text`, `provider_chat_id text`, `buttons jsonb`, `reply_to_queue_id uuid` (для последующего edit).
- Триггер `assign_executor_guard`: `BEFORE UPDATE` — если `OLD.executor IS NOT NULL AND NEW.executor IS DISTINCT FROM OLD.executor AND current_setting('app.allow_reassign', true) IS DISTINCT FROM 'true'` → `RAISE`.
- `request_activities`: уже есть, используем `action='executor_assigned'` с `source='chat_button'` в snapshot.

### Edge functions

- `notification-worker` — расширить:
  - если `payload.buttons` — собирать `reply_markup`/`attachments` с `callback_data = "assign:{request_id}:{executor_id}"`.
  - для MAX использовать `inline_keyboard` через Bot API `attachments: [{type:'inline_keyboard', payload:{buttons:[[…]]}}]`.
  - после успешной отправки писать `provider_message_id`, `provider_chat_id` в `notification_queue`.
- `telegram-webhook` — обработать `callback_query` с префиксом `assign:` → вызвать `assign-executor`.
- `max-webhook` — то же для `callback`.
- **Новая** `assign-executor` (service role):
  - входит `{request_id, executor_id, source:'telegram'|'max', chat_id, message_id, user}`.
  - `SET LOCAL app.allow_reassign = 'false'` — пускай триггер защищает.
  - атомарный апдейт; при конфликте отвечает `answerCallbackQuery` «Исполнитель уже выбран».
  - редактирует исходное сообщение → `✅ Исполнитель назначен: {executor}` (без кнопок).
  - audit log + ответ `answerCallbackQuery`.

### Источник исполнителей

Берём `request_participants WHERE participant_type='executor' AND is_active`. Кнопки рендерим в 2 колонки, обрезаем длинные ФИО до 30 симв. (лимит callback_data — кладём только `executor_id`).

### UI (минимум)

- В `RequestForm`: дефолтный статус новой заявки = `Входящая заявка`, статус в селекторе доступен.
- В `ProductionNotificationsPanel`: добавить `incoming` в типы групп.
- Без новых страниц — назначение через realtime обновит таблицу `/requests`.

## Защита и логирование

- Конфликт назначения: триггер БД + проверка `executor IS NULL` в `UPDATE … RETURNING` — двойная защита от гонок.
- Audit: `request_activities` (`action='executor_assigned'`, snapshot со старым/новым статусом, `user_id` берётся из webhook'а — маппинг telegram_user_id/max_user_id → `profiles` через существующую таблицу связей; если нет — пишем `null` и сохраняем raw chat user в snapshot).
- Idempotency: `callback_data` содержит `request_id`+`executor_id`; повтор нажатия → 0 строк апдейта → «Исполнитель уже выбран».

## Файлы

- `supabase/migrations/<ts>_incoming_requests_routing.sql`
- `supabase/functions/notification-worker/index.ts` (правка)
- `supabase/functions/telegram-webhook/index.ts` (callback)
- `supabase/functions/max-webhook/index.ts` (callback)
- `supabase/functions/assign-executor/index.ts` (новая)
- `src/components/requests/RequestForm.tsx` (default status)
- `src/components/settings/ProductionNotificationsPanel.tsx` (тип `incoming`)

## Открытые вопросы

1. Использовать существующий статус `Новая заявка` или переименовать что-то? Подтверждаю: `Входящая заявка` — новый, `Новая заявка` — уже есть.
2. Маппинг telegram_user_id → CRM user для audit — есть ли таблица? Если нет, ограничимся записью username в snapshot.
3. MAX API: поддержка `inline_keyboard` через `attachments` — проверю текущую реализацию `max-webhook`/MAX отправителя.

Подтверди план — начну с миграции БД.
