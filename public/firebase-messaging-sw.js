/* eslint-disable no-undef */
// SOT Faculty Portal - Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyByWZ3nRHHWxGTXmr94thI8ithkA5cjbcs',
  authDomain: 'sot-portal.firebaseapp.com',
  projectId: 'sot-portal',
  storageBucket: 'sot-portal.firebasestorage.app',
  messagingSenderId: '805818332164',
  appId: '1:805818332164:web:c08e89f29561b473acb151'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background push notification received:', payload);
  const title = payload.notification?.title || payload.data?.title || 'SOT Notification';
  const targetLink = payload.fcmOptions?.link || payload.data?.link || '/dashboard';

  const options = {
    body: payload.notification?.body || payload.data?.body || 'New update posted on the SOT Portal',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: {
      link: targetLink
    }
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetLink = event.notification.data?.link || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url && 'focus' in client) {
          client.navigate(targetLink);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetLink);
      }
    })
  );
});
