/* global importScripts, firebase */
/**
 * FCM background message handler (served at /firebase-messaging-sw.js).
 *
 * A service worker cannot import the app's TypeScript config, so the Firebase
 * config must be duplicated here. Keep these values in sync with
 * src/app/core/firebase/firebase.config.ts (these are not secrets).
 */
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

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'NewsTracker';
  const options = {
    body: (payload.notification && payload.notification.body) || '',
    icon: '/favicon.ico',
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

/**
 * Decide what a notification click is allowed to open.
 *
 * `data.link` reaches us from a push payload, and for news notifications the
 * backend copies it straight out of an RSS feed — so it is third-party text,
 * not something this app authored. Handing it to openWindow() unchecked means
 * a feed entry can choose the destination of a click on a notification that
 * carries our name and icon.
 *
 * Only two shapes are honoured: an in-app path, and an absolute https:// URL
 * (news articles legitimately live off-site). Everything else — javascript:,
 * data:, blob:, file:, protocol-relative "//evil.example" — falls back to the
 * app root rather than being opened.
 */
function safeNotificationTarget(rawLink) {
  if (typeof rawLink !== 'string' || !rawLink) {
    return '/';
  }
  // "//host" is protocol-relative and would resolve off-origin despite looking
  // like a path, so require a single leading slash.
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

// Focus/open the app when the user clicks the notification.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = safeNotificationTarget(
    event.notification.data && event.notification.data.link,
  );
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find((client) => 'focus' in client);
      if (existing) {
        return existing.focus();
      }
      return self.clients.openWindow(link);
    }),
  );
});
