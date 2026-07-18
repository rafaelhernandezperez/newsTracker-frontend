import { FirebaseApp, getApps, initializeApp } from 'firebase/app';

/**
 * Firebase web configuration.
 *
 * `vapidKey` is the Web Push certificate key pair, found under:
 *   Project settings → Cloud Messaging → Web configuration → "Web Push certificates".
 *
 * These values are NOT secrets (they ship in the browser bundle); access is
 * controlled by Firebase security rules + authorized domains.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyAIcHW9QHe268UODLYCMH5p35rNOrQdOPA',
  authDomain: 'financialnewstracker.firebaseapp.com',
  projectId: 'financialnewstracker',
  storageBucket: 'financialnewstracker.firebasestorage.app',
  messagingSenderId: '122616090189',
  appId: '1:122616090189:web:c2d74d3e8c353fb4d41604',
};

/** VAPID key for FCM Web Push (Cloud Messaging → Web configuration). */
export const firebaseVapidKey = 'BAVuLc11NKokwyC1_U01uIy7O9GdNUcEQLUHj-0aH68ir7lToNva_6MUYAMyKTGJkNysuDaB3MzntSLdv-A6J-I';

/** Initialize (or reuse) the singleton Firebase app. */
export function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}
