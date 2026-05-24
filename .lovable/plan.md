## Workflow счёта в чате «Счета на оплату»

### Текущее состояние
- При появлении счёта (`invoice.created`) в чат «Счета на оплату» уходит сообщение + PDF.
- Никаких inline-кнопок нет.

### Новый сценарий

```text
1. Счёт пришёл в чат «Счета на оплату»
   Сообщение + PDF + кнопки:
   [ Отписать в оплату ]   [ Отписать в ТО ]

2a. Нажали «Отписать в оплату»
    Сообщение редактируется → добавляется строка
    «Выбрано: Отписать в оплату — @username»
    Кнопки заменяются на:
    [ ✅ Подтвердить: в оплату ]   [ ↩ Отмена ]

2b. Нажали «Отписать в ТО»
    Аналогично → 
    [ ✅ Подтвердить: в ТО ]       [ ↩ Отмена ]

3a. Подтвердили «в оплату»
    - requests.invoice_routing = 'payment'
    - Сообщение редактируется: «✅ Отписан в оплату @username»
    - В чат «Счета на оплату» (или отдельный routing) уходит НОВОЕ сообщение:
      «💰 ОПЛАТИТЬ СЧЁТ» + краткая карточка + PDF

3b. Подтвердили «в ТО»
    - requests.invoice_routing = 'to'
    - Сообщение редактируется: «✅ Отписан в ТО @username»
    - (опционально) событие invoice.routed_to_to

4. «Отмена» возвращает к шагу 1 (кнопки снова «Отписать в оплату/ТО»).
```

### Изменения

**БД (миграция):**
- `requests.invoice_routing text` (`null` | `payment` | `to`).
- `requests.invoice_routed_at timestamptz`, `invoice_routed_by uuid`.
- В `notify_request_event()` для `invoice.created` payload включает `kind: 'invoice_route'` + `buttons: [{id:'invoice_route_pay', name:'Отписать в оплату'}, {id:'invoice_route_to', name:'Отписать в ТО'}]`.
- Новое событие `invoice.pay_now` — генерируется при подтверждении «в оплату»: формирует сообщение «💰 ОПЛАТИТЬ СЧЁТ …» и шлёт PDF.
- Routing rule для `invoice.pay_now` → `notification_type='invoice'`.

**Edge functions:**
- `notification-worker` — добавить поддержку произвольных `callback_data`/`payload` префиксов:
  - `invoice_route:{request_id}:pay|to`
  - `invoice_confirm:{request_id}:pay|to`
  - `invoice_cancel:{request_id}`
  - При отправке счёта сохранять `provider_message_id`/`provider_chat_id` (уже есть) и `payload.kind='invoice_route'`.
- Новая функция **`invoice-route`** (по образцу `assign-executor`):
  - принимает `{request_id, action: 'select_pay'|'select_to'|'confirm_pay'|'confirm_to'|'cancel', chat_id, message_id, platform, user}`.
  - `select_*` → editMessage с новой клавиатурой «Подтвердить / Отмена».
  - `confirm_pay` → UPDATE requests SET invoice_routing='payment', шлёт `invoice.pay_now`.
  - `confirm_to` → UPDATE requests SET invoice_routing='to', editMessage финальный.
  - `cancel` → editMessage обратно к первичным кнопкам.
  - audit_log на каждое подтверждение.
- `telegram-webhook` и `max-webhook` — обработать префиксы `invoice_*` → вызов `invoice-route`.

### Открытые вопросы
1. «ОПЛАТИТЬ СЧЁТ» уходит в тот же чат «Счета на оплату» или нужен отдельный (например, для бухгалтера)?
2. Кто имеет право жать кнопки — любой участник чата или только админы/бухгалтер? Если ограничивать — по какому полю (telegram username / max user id → profiles)?
3. После «Отписать в ТО» нужно ли отдельное сообщение (типа «📦 Передан в ТО»), и в какой чат?

Подтверди — начну с миграции БД.
