# План: Система Telegram-уведомлений по срокам заявок

## Что есть сейчас

- Telegram уже подключён (`telegram_settings`, edge function `notify-telegram`, бот, чаты)
- Есть `check-delivery-arrived` (день прибытия) и `check-deadline-reminders` (за N дней) — но они создают только **внутренние** уведомления (`notifications` table), **не шлют в Telegram**
- Есть поля `shipment_date`, `delivery_date`, `status` в `requests`

## Что нужно добавить

### 1. БД (миграция)

Таблица **`request_notification_log`** для защиты от дублей:
- `request_id`, `notification_type` (`shipment_tomorrow` | `arrival_3d` | `arrival_1d` | `arrival_today` | `overdue`), `sent_at`
- UNIQUE(request_id, notification_type)

Таблица **`notification_schedule_settings`** (per organization):
- toggles: `notify_shipment_tomorrow`, `notify_arrival_3d`, `notify_arrival_1d`, `notify_arrival_today`, `notify_overdue`, `enabled`
- `send_time` (HH:MM, default 09:00)

Опционально поле `actual_arrival_date` в `requests` (фиксация факта прибытия при статусе «Доставлено»).

### 2. Edge function `check-shipment-notifications`

Ежедневный обход всех активных заявок (status NOT IN финальных, archived = false):
- завтра отгрузка → 🚛
- прибытие через 3 / 1 / 0 дней → 📦 / ⚠️ / ✅
- просрочка (delivery_date < today, статус не «Доставлено»/«Прибыло») → ❌

Для каждого случая:
1. Проверить toggle в `notification_schedule_settings`
2. Проверить `request_notification_log` — не отправляли ли уже
3. Отправить через тот же механизм, что и `notify-telegram` (или прямым sendMessage)
4. Записать в лог

### 3. Cron-job

`pg_cron` ежедневно в 09:00 МСК → POST на edge function (через `supabase--insert`, не миграция).

### 4. UI

**Настройки → Уведомления (`NotificationSettings.tsx`):**
- секция «Telegram-напоминания по заявкам» с 5 чекбоксами + время

**Карточка заявки (`RequestLogisticsCard` или новый блок):**
- статус 4 уведомлений (отправлено/не отправлено + дата)
- цветные индикаторы дат:
  - зелёный — > 3 дн.
  - жёлтый — 3 дн.
  - оранжевый — завтра
  - красный — просрочка / сегодня прибытие
- кнопки **«Отправить вручную»** и **«Повторить»** (вызов того же edge function с `force=true` и `requestId`)

### 5. Ручная отправка

Edge function принимает `{ requestId?, force? }`:
- если есть `requestId` — обработать только её
- если `force=true` — игнорировать лог дублей

## Технические детали

```text
cron 09:00 MSK
  └─> check-shipment-notifications (Edge)
        ├─ select requests (active, has dates)
        ├─ for each: compute которое уведомление подходит сегодня
        ├─ check settings + log
        ├─ sendMessage в telegram_settings.chat_id
        └─ insert into request_notification_log
```

Сообщения формируются в едином хелпере `formatNotification(type, request)` — HTML parse_mode, эмодзи как в ТЗ.

При смене статуса на «Доставлено» — триггер БД проставляет `actual_arrival_date = now()` и блокирует overdue-уведомления (за счёт фильтра в edge function).

## Файлы

**Новые:**
- `supabase/functions/check-shipment-notifications/index.ts`
- `src/components/request/RequestNotificationsCard.tsx`

**Правки:**
- `src/components/settings/NotificationSettings.tsx` — секция расписания
- `src/pages/RequestDetail.tsx` — вставить карточку уведомлений
- `src/components/request/RequestLogisticsCard.tsx` — цветные бейджи дат

## Что НЕ входит в этот заход

- Отдельная вкладка журнала уведомлений (можно добавить позже — данные уже есть в `request_notification_log`)
- SMS / email каналы

---

Подтвердите план — начну с миграции БД, затем edge function, cron и UI.
