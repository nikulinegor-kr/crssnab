# Мобильное приложение CRSS для iPhone (TestFlight)

Цель: собрать текущую CRM в настоящее iOS-приложение через Capacitor, не меняя бизнес-логику и существующие данные. Приложение подтягивает интерфейс с вашего сайта (правки видны сразу, без пересборки), работает с тем же бэкендом и аккаунтами.

## Что получит пользователь

- Приложение на iPhone с иконкой, заставкой и корректными отступами под «чёлку» и нижнюю полосу.
- Вход по Face ID: пароль вводится один раз, дальше — по лицу. Переключатель в профиле, всегда есть запасной вход по паролю.
- Настоящие push-уведомления от Apple по тем же событиям, что уже есть в системе (статусы заявок, комментарии, напоминания). Значок с числом непрочитанных, переход по нажатию сразу в нужную заявку.
- Камера: снимок счёта или фото ТМЦ прямо из карточки заявки, плюс выбор из галереи — там, где сейчас загружаются файлы.
- Файлы: открытие и сохранение PDF/Excel (счета, ведомости, отчёты) через стандартное меню «Поделиться» iOS.
- Ссылки вида crssnab.com/requests/... открываются сразу в приложении, а не в браузере.
- Аккуратное поведение офлайн: понятное сообщение вместо белого экрана.

## Что нужно от вас (без этого TestFlight невозможен)

1. Платный Apple Developer аккаунт (99 $/год).
2. Mac с Xcode — сборка и загрузка в TestFlight делается там.
3. Ключ APNs (.p8) из Apple Developer для отправки пушей — добавим его как секрет в бэкенд.

Приложение нельзя собрать и отправить в TestFlight прямо здесь: после моей работы вы выгружаете проект в GitHub, забираете его на Mac и выполняете несколько команд — точный список будет в инструкции.

## Технический план

**Capacitor**
- Установить `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`; создать `capacitor.config.ts` с `appId: app.lovable.p03d26285f32f457cbdfeb9b17be007d2`, `appName: crssnab`, `webDir: dist`.
- Режим «автообновление с сайта»: `server.url = https://crssnab.com`, `cleartext: true`. Это допускает быстрые правки без пересборки; при ревью Apple может потребовать переключиться на локальный бандл — в конфиге оставим комментарий, как это сделать одной строкой.
- Плагины: `@capacitor/push-notifications`, `@capacitor/camera`, `@capacitor/filesystem`, `@capacitor/share`, `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/preferences`, `capacitor-native-biometric`.

**Оболочка UI**
- `src/lib/native.ts` — единая точка определения нативной среды (`Capacitor.isNativePlatform()`), чтобы веб-версия не менялась.
- Safe-area: CSS-переменные `env(safe-area-inset-*)` в `index.css`, применение в `AppLayout` и `MobileBottomNav`.
- Инициализация в `main.tsx`: StatusBar (стиль под тему), SplashScreen.hide() после монтирования, обработчик аппаратной кнопки «назад»/свайпа.

**Face ID (быстрый вход)**
- `src/hooks/useBiometricAuth.ts`: после успешного входа по паролю refresh-токен сессии кладётся в Keychain (`capacitor-native-biometric` + `@capacitor/preferences` только для флага включения).
- На старте: если флаг включён — запрос Face ID, при успехе `supabase.auth.setSession`, при отказе — обычная форма входа.
- Переключатель «Вход по Face ID» в `ProfilePage` и в настройках уведомлений — только на нативной платформе.

**Push через APNs**
- Новая таблица `device_push_tokens` (user_id, organization_id, token, platform, created_at) — существующие таблицы не трогаем. RLS: пользователь видит и пишет только свои строки; GRANT для `authenticated`, полный доступ `service_role`.
- Регистрация токена при входе, удаление при выходе; слушатели `pushNotificationReceived` / `pushNotificationActionPerformed` с переходом по `deep link` в заявку.
- Edge-функция `send-apns-push`: подписывает JWT ключом APNs (.p8, секреты `APNS_KEY_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`) и шлёт в `api.push.apple.com`.
- Подключение к существующей очереди: `notification-worker` дополнительно вызывает `send-apns-push` для получателей с токенами. Текущая логика Telegram/MAX и правила маршрутизации не меняются.

**Камера и файлы**
- `src/hooks/useNativeCamera.ts` — обёртка над `Camera.getPhoto`, возвращает `File` для существующих загрузчиков (`FileDropZone`, `MultiFileDropZone`, распознавание счетов). На вебе поведение прежнее.
- Экспорт PDF/Excel на нативе: запись через `Filesystem` в кэш + `Share.share`, вместо скачивания через ссылку.

**Deep links**
- `App.addListener('appUrlOpen')` → разбор пути → `navigate()` в React Router.
- В инструкции: Associated Domains (`applinks:crssnab.com`) и файл `apple-app-site-association` в `public/.well-known/`.

**Документация**
- `MOBILE_IOS.md`: экспорт в GitHub, `npm install`, `npx cap add ios`, `npx cap sync`, настройка capabilities (Push, Associated Domains, Face ID usage strings), архив в Xcode и загрузка в TestFlight.

## Что НЕ меняется

Схема существующих таблиц, RLS существующих таблиц, логика заявок, склада, планировщика, Telegram/MAX-интеграции и веб-версия сайта.
