import { FirebaseApp, getApps, initializeApp } from 'firebase/app';

/**
 * Firebase web configuration.
 *
 * Replace these placeholders with the values from your Firebase project:
 *   Firebase console → Project settings → General → "Your apps" → Web app → SDK setup.
 *
 * `vapidKey` is the Web Push certificate key pair, found under:
 *   Project settings → Cloud Messaging → Web configuration → "Web Push certificates".
 *
 * These values are NOT secrets (they ship in the browser bundle); access is
 * controlled by Firebase security rules + authorized domains.
 */
export const firebaseConfig = {
  apiKey: 'REPLACE_WITH_API_KEY',
  authDomain: 'REPLACE_WITH_PROJECT_ID.firebaseapp.com',
  projectId: 'REPLACE_WITH_PROJECT_ID',
  storageBucket: 'REPLACE_WITH_PROJECT_ID.appspot.com',
  messagingSenderId: 'REPLACE_WITH_SENDER_ID',
  appId: 'REPLACE_WITH_APP_ID',
};

/** VAPID key for FCM Web Push (Cloud Messaging → Web configuration). */
export const firebaseVapidKey = 'REPLACE_WITH_VAPID_KEY';

/** Initialize (or reuse) the singleton Firebase app. */
export function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}
