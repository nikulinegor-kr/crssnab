# CRSS для iPhone — сборка и публикация в TestFlight

Приложение — нативная оболочка (Capacitor) вокруг рабочего сайта `https://crssnab.com`.
Интерфейс обновляется автоматически при публикации сайта: пересобирать приложение
нужно только при изменении нативных возможностей (пуши, камера, Face ID, версия).

## Что уже готово в проекте

- `capacitor.config.ts` — идентификатор приложения `app.lovable.p03d26285f32f457cbdfeb9b17be007d2`, имя `crssnab`, загрузка интерфейса с сайта.
- Face ID / Touch ID: быстрый вход (включается в Профиле → Безопасность).
- Камера и выбор фото из галереи, сохранение и «Поделиться» для документов.
- Push-уведомления Apple: устройство регистрируется в таблице `device_push_tokens`, уведомление уходит автоматически при создании записи в уведомлениях.
- Deep links: файл `public/.well-known/apple-app-site-association` (нужно подставить Team ID).

## Что нужно вам

1. Аккаунт Apple Developer Program (99 $ в год).
2. Mac с установленным Xcode 15+.
3. Ключ APNs (`.p8`) из App Store Connect → Keys.

## Шаги сборки

```bash
# 1. Выгрузите проект на GitHub (кнопка Export to GitHub) и склонируйте на Mac
git clone <ваш-репозиторий> && cd <папка>

# 2. Зависимости
npm install

# 3. Добавьте платформу iOS
npx cap add ios

# 4. Сборка веб-части и синхронизация
npm run build
npx cap sync

# 5. Открыть в Xcode
npx cap open ios
```

При каждом обновлении из GitHub: `git pull && npm install && npm run build && npx cap sync`.

## Настройка в Xcode

1. Target → Signing & Capabilities → выберите свою команду (Team). Запомните **Team ID**.
2. Нажмите «+ Capability» и добавьте:
   - **Push Notifications**
   - **Background Modes** → отметьте *Remote notifications*
   - **Associated Domains** → добавьте `applinks:crssnab.com` и `applinks:www.crssnab.com`
3. В `Info.plist` добавьте описания доступов (иначе Apple отклонит):
   - `NSCameraUsageDescription` — «Для фотографирования счетов, накладных и материалов»
   - `NSPhotoLibraryUsageDescription` — «Для прикрепления фотографий к заявкам»
   - `NSPhotoLibraryAddUsageDescription` — «Для сохранения документов»
   - `NSFaceIDUsageDescription` — «Для быстрого входа в приложение»
4. Установите иконку приложения и экран запуска (Assets.xcassets).

## Deep links

В файле `public/.well-known/apple-app-site-association` замените `TEAMID` на свой Team ID
и опубликуйте сайт. Файл должен открываться по адресу
`https://crssnab.com/.well-known/apple-app-site-association`.

## Push-уведомления: ключи Apple

В настройках бэкенда нужно добавить секреты:

| Секрет | Где взять |
|---|---|
| `APNS_KEY_P8` | содержимое файла `AuthKey_XXXX.p8` целиком, включая строки BEGIN/END |
| `APNS_KEY_ID` | идентификатор ключа (10 символов) из App Store Connect → Keys |
| `APNS_TEAM_ID` | Team ID из Apple Developer → Membership |
| `APNS_BUNDLE_ID` | `app.lovable.p03d26285f32f457cbdfeb9b17be007d2` |
| `APNS_PRODUCTION` | `false` при тестах через Xcode, `true` для TestFlight и App Store |

Пока ключи не добавлены, приложение работает полностью, но пуши не отправляются.

## TestFlight

1. В App Store Connect создайте приложение с тем же Bundle ID.
2. В Xcode: Product → Archive (устройство «Any iOS Device»).
3. В окне Organizer → Distribute App → App Store Connect → Upload.
4. Дождитесь обработки сборки, заполните «Что тестировать» и добавьте тестировщиков
   (внутренние — сразу, внешние — после короткой проверки Apple).

## Если Apple попросит автономную сборку

Удалите блок `server` из `capacitor.config.ts`, затем `npm run build && npx cap sync` —
интерфейс будет упакован внутрь приложения.
