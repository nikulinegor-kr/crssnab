function normalizeNotificationLink(link) {
  if (!link || !link.startsWith('/') || link.startsWith('//')) return '/me';
  const request = link.match(/^\/requests\/([0-9a-f-]{36})(?:[?#].*)?$/i);
  if (request) return '/requests?request=' + request[1];
  const task = link.match(/^\/tasks\/([0-9a-f-]{36})$/i);
  if (task) return '/tasks?task=' + task[1];
  return link.replace(/^\/planner\?task=/, '/tasks?task=');
}
// CRSS Снаб — Service Worker для браузерных уведомлений
// Обрабатывает: notification click (фокус/навигация), push, message (триггер из приложения).

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Триггер показа уведомления из основного приложения
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'show-notification') {
    const { title, body, url, tag, icon, badge } = data;
    event.waitUntil(
      self.registration.showNotification(title || 'Уведомление', {
        body: body || '',
        icon: icon || '/icons/icon-192.png',
        badge: badge || '/icons/icon-192.png',
        tag: tag || undefined,
        renotify: false,
        requireInteraction: false,
        data: { url: normalizeNotificationLink(url) },
      })
    );
  }
});

// Если когда-то подключим Web Push — структура полезной нагрузки уже совместима
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'Уведомление', body: event.data ? event.data.text() : '' };
  }
  const { title = 'Уведомление', body = '', url = '/', tag, icon, badge } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || '/icons/icon-192.png',
      badge: badge || '/icons/icon-192.png',
      tag,
      renotify: false,
      data: { url: normalizeNotificationLink(url) },
    })
  );
});

// Клик по уведомлению → фокус на открытой вкладке или открытие новой
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = normalizeNotificationLink(event.notification.data && event.notification.data.url);

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Если есть открытая вкладка нашего приложения — фокусим и навигируем
    for (const client of allClients) {
      try {
        const clientUrl = new URL(client.url);
        const currentOrigin = self.location.origin;
        if (clientUrl.origin === currentOrigin) {
          await client.focus();
          if ('navigate' in client) {
            try { await client.navigate(targetUrl); } catch (_) {}
          } else {
            client.postMessage({ type: 'navigate', url: targetUrl });
          }
          return;
        }
      } catch (_) {}
    }
    // Иначе открываем новую
    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});
