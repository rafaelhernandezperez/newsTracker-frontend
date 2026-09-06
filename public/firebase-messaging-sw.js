/* global importScripts, firebase */
/** Keep Firebase configuration in sync with src/app/core/firebase/firebase.config.ts. */
importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAIcHW9QHe268UODLYCMH5p35rNOrQdOPA',
  authDomain: 'financialnewstracker.firebaseapp.com',
  projectId: 'financialnewstracker',
  storageBucket: 'financialnewstracker.firebasestorage.app',
  messagingSenderId: '122616090189',
  appId: '1:122616090189:web:c2d74d3e8c353fb4d41604',
});

const messaging = firebase.messaging();

// Activate notification updates on reload without waiting for every tab to close.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = data.title || 'NewsTracker';
  const options = {
    body: data.body || '',
    icon: '/notification-icon.png',
    data,
    tag: data.newsId ? `newstracker-${data.newsId}` : undefined,
    requireInteraction: Boolean(data.newsId && data.newsId.startsWith('push-test-')),
  };
  return self.registration.showNotification(title, options);
});

/** Validate feed-provided links before passing them to notification navigation. */
function safeNotificationTarget(rawLink) {
  if (typeof rawLink !== 'string' || !rawLink) {
    return '/';
  }
  // Reject protocol-relative URLs when accepting in-app paths.
  if (rawLink.startsWith('/') && !rawLink.startsWith('//')) {
    return rawLink;
  }
  try {
    const url = new URL(rawLink, self.location.origin);
    return url.protocol === 'https:' ? url.href : '/';
  } catch {
    return '/';
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = safeNotificationTarget(event.notification.data && event.notification.data.link);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const target = new URL(link, self.location.origin);
      if (target.origin !== self.location.origin) {
        return self.clients.openWindow(target.href);
      }

      const existing = clientList.find((client) => 'focus' in client);
      if (existing) {
        const navigated =
          'navigate' in existing ? existing.navigate(target.href) : Promise.resolve(existing);
        return navigated.then((client) =>
          client && 'focus' in client ? client.focus() : undefined,
        );
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
