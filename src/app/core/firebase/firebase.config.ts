import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
  AppCheck,
  ReCaptchaV3Provider,
  getToken,
  initializeAppCheck,
} from 'firebase/app-check';

/** Public browser configuration; keep it in sync with public/firebase-messaging-sw.js. */
const firebaseConfig = {
  apiKey: 'AIzaSyAIcHW9QHe268UODLYCMH5p35rNOrQdOPA',
  authDomain: 'financialnewstracker.firebaseapp.com',
  projectId: 'financialnewstracker',
  storageBucket: 'financialnewstracker.firebasestorage.app',
  messagingSenderId: '122616090189',
  appId: '1:122616090189:web:c2d74d3e8c353fb4d41604',
};

/** VAPID key for FCM Web Push (Cloud Messaging → Web configuration). */
export const firebaseVapidKey =
  'BAVuLc11NKokwyC1_U01uIy7O9GdNUcEQLUHj-0aH68ir7lToNva_6MUYAMyKTGJkNysuDaB3MzntSLdv-A6J-I';

/**
 * reCAPTCHA v3 site key for App Check. Public by design — it is bound to the
 * domains you register in the Firebase console, which is what makes it useful.
 *
 * Get it from Firebase console → App Check → Apps → register this web app with
 * the reCAPTCHA v3 provider, and paste the SITE key (not the secret) here.
 * Leave it empty and App Check simply stays off: the app keeps working, and the
 * backend keeps accepting unattested requests while APP_CHECK_ENFORCED is unset.
 */
export const appCheckSiteKey = '';

export function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}

let appCheckInstance: AppCheck | null = null;

/**
 * Initialize App Check once, on first use. Returns null when no site key is
 * configured, so a fresh clone of this repo runs without a console setup step.
 */
export function getAppCheckInstance(): AppCheck | null {
  if (!appCheckSiteKey) {
    return null;
  }
  appCheckInstance ??= initializeAppCheck(getFirebaseApp(), {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    // Refresh in the background so a long session never sends a stale token.
    isTokenAutoRefreshEnabled: true,
  });
  return appCheckInstance;
}

/**
 * Current App Check token, or null when App Check is off or attestation failed.
 *
 * Failure is deliberately non-fatal: a blocked reCAPTCHA domain or a privacy
 * extension must not take the whole app down. The request goes out unattested
 * and the backend decides what to do with it.
 */
export async function getAppCheckToken(): Promise<string | null> {
  const appCheck = getAppCheckInstance();
  if (!appCheck) {
    return null;
  }
  try {
    const { token } = await getToken(appCheck, /* forceRefresh */ false);
    return token;
  } catch (error) {
    console.warn('[appCheck] attestation failed; sending request unattested:', error);
    return null;
  }
}
