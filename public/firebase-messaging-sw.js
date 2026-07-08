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

// Focus/open the app when the user clicks the notification.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
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
