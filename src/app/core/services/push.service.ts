import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';
import { getFirebaseApp, firebaseVapidKey } from '../firebase/firebase.config';

const STORED_FCM_TOKEN = 'nt.fcmToken';

export type PushEnableResult = 'enabled' | 'denied' | 'dismissed' | 'unsupported' | 'failed';
export type PushTestResult = 'received' | 'sent' | 'no-device' | 'no-news' | 'failed';

/**
 * FCM Web Push registration for the desktop browser app. Requests notification
 * permission, obtains the device token and registers it with the backend
 * (`/api/devices`) so the daily digest can reach this device. Also surfaces
 * foreground messages as native notifications.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly http = inject(HttpClient);
  private messaging: Messaging | null = null;
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private foregroundBound = false;
  private registeredToken: string | null = this.readStoredToken();
  private refreshPromise: Promise<PushEnableResult> | null = null;
  private readonly testReceiptWaiters = new Set<(newsId: string) => void>();

  /**
   * Enable push for the current (already authenticated) user, prompting for
   * notification permission if needed. Safe to call more than once; returns
   * an explicit outcome so callers never have to fail silently.
   */
  enable(): Promise<PushEnableResult> {
    if (!this.hasBrowserPushApis()) {
      return Promise.resolve('unsupported');
    }

    // requestPermission() must be CALLED while the click/tap still owns the
    // browser's transient user activation. Do not put an `await` (including
    // isSupported()) before this line: Safari and other browsers may otherwise
    // suppress the permission prompt.
    let permissionPromise: Promise<NotificationPermission>;
    try {
      permissionPromise =
        Notification.permission === 'default'
          ? Notification.requestPermission()
          : Promise.resolve(Notification.permission);
    } catch (error) {
      console.error('[push] permission request failed:', error);
      return Promise.resolve('failed');
    }

    return this.registerAfterPermission(permissionPromise, true);
  }

  /**
   * Silently re-register the FCM token when permission was already granted.
   * Called on app start for returning sessions: enable() only runs at
   * login/onboarding, but FCM tokens rotate, so without this a token would
   * eventually go stale and pushes would stop reaching the device.
   */
  refreshIfGranted(): Promise<PushEnableResult> {
    if (!this.hasBrowserPushApis()) {
      return Promise.resolve('unsupported');
    }
    if (Notification.permission !== 'granted') {
      return Promise.resolve(Notification.permission === 'denied' ? 'denied' : 'dismissed');
    }
    // App startup and the settings test can ask for a refresh at the same time.
    // Share one attempt so the test cannot race ahead of the foreground
    // listener while a second registration is still in flight.
    this.refreshPromise ??= this.registerAfterPermission(
      Promise.resolve('granted'),
      false,
    ).finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private hasBrowserPushApis(): boolean {
    return (
      typeof Notification !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator
    );
  }

  private async registerAfterPermission(
    permissionPromise: Promise<NotificationPermission>,
    prompted: boolean,
  ): Promise<PushEnableResult> {
    if (firebaseVapidKey.startsWith('REPLACE_')) {
      // FCM needs a Web Push certificate (VAPID key); skip until it is set.
      console.error('[push] Firebase VAPID key is not configured');
      return 'failed';
    }
    try {
      const permission = await permissionPromise;
      if (permission !== 'granted') {
        if (prompted) {
          console.warn('[push] notification permission not granted:', permission);
        }
        return permission === 'denied' ? 'denied' : 'dismissed';
      }

      if (!(await isSupported())) {
        console.warn('[push] FCM not supported in this browser');
        return 'unsupported';
      }

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      this.serviceWorkerRegistration = registration;
      this.messaging ??= getMessaging(getFirebaseApp());

      // A focused page receives FCM messages through onMessage(), not through
      // the background worker. Bind before token/API work: an already-valid
      // subscription can receive a push while either network request is still
      // running, and dropping that event produces exactly the misleading
      // "Firebase accepted" / no-banner state the test is meant to diagnose.
      this.bindForegroundMessages();

      const token = await getToken(this.messaging, {
        vapidKey: firebaseVapidKey,
        serviceWorkerRegistration: registration,
      });

      if (!token) {
        console.warn('[push] empty FCM token');
        return 'failed';
      }

      await firstValueFrom(this.http.post('/api/devices', { token, platform: 'web' }));
      this.registeredToken = token;
      this.storeToken(token);
      return 'enabled';
    } catch (error) {
      console.error('[push] registration failed:', error);
      return 'failed';
    }
  }

  /** Detach this browser from the signed-in account before logging out. */
  async unregisterCurrentDevice(): Promise<boolean> {
    const token = this.registeredToken ?? this.readStoredToken();
    if (!token) {
      return true;
    }
    try {
      await firstValueFrom(this.http.delete(`/api/devices/${encodeURIComponent(token)}`));
      this.registeredToken = null;
      try {
        localStorage.removeItem(STORED_FCM_TOKEN);
      } catch {
        // Storage can be unavailable in hardened/private browsing modes.
      }
      return true;
    } catch (error) {
      console.error('[push] device unregister failed:', error);
      return false;
    }
  }

  /** Whether this browser currently has a token associated with an account. */
  isCurrentDeviceRegistered(): boolean {
    return Boolean(this.registeredToken ?? this.readStoredToken());
  }

  /** Send a real stored company story through the authenticated backend and FCM. */
  async sendTestNotification(language: 'en' | 'es'): Promise<PushTestResult> {
    // Do not trust the token cached in localStorage as proof that this page is
    // ready to receive a foreground data message. Refreshing first guarantees
    // that onMessage is attached before the backend sends the test.
    const readiness = await this.refreshIfGranted();
    if (readiness !== 'enabled') {
      return readiness === 'dismissed' || readiness === 'denied' ? 'no-device' : 'failed';
    }

    const testId = this.createTestId();
    const receipt = this.waitForTestReceipt(`push-test-${testId}`);
    try {
      await firstValueFrom(this.http.post('/api/devices/test', { language, testId }));
      // Copy generation happens before FCM send and may take several seconds.
      // Start the delivery window only once the backend has accepted the push;
      // the waiter itself was already registered, so an unusually fast receipt
      // that arrives before the HTTP response is still captured.
      receipt.startTimeout();
      return (await receipt.promise) ? 'received' : 'sent';
    } catch (error) {
      receipt.cancel();
      if (error instanceof HttpErrorResponse && error.status === 409) {
        return error.error?.code === 'no-news' ? 'no-news' : 'no-device';
      }
      console.error('[push] test notification failed:', error);
      return 'failed';
    }
  }

  /**
   * Display polished sample copy using the browser Notification API. Useful for
   * a visual/screenshot check; unlike sendTestNotification(), it does not prove
   * that the backend and FCM delivery path are reachable.
   */
  showLocalPreview(language: 'en' | 'es'): boolean {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return false;
    }
    try {
      const spanish = language === 'es';
      const notification = new Notification('Bank of America (BAC)', {
          body: spanish
            ? 'La SEC acusó a un exbanquero de Bank of America por filtraciones que presuntamente generaron 18,5 millones de dólares en beneficios ilegales.'
            : 'The SEC charged a former Bank of America banker over tips that allegedly generated $18.5 million in illegal profit.',
          icon: '/notification-icon.png',
          tag: 'newstracker-thesis-preview',
          requireInteraction: true,
        });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      return true;
    } catch (error) {
      console.error('[push] local notification preview failed:', error);
      return false;
    }
  }

  private readStoredToken(): string | null {
    try {
      return localStorage.getItem(STORED_FCM_TOKEN);
    } catch {
      return null;
    }
  }

  private storeToken(token: string): void {
    try {
      localStorage.setItem(STORED_FCM_TOKEN, token);
    } catch {
      // The in-memory copy still supports logout during this app session.
    }
  }

  /** Show foreground pushes as native notifications (SW handles background). */
  private bindForegroundMessages(): void {
    if (this.foregroundBound || !this.messaging) {
      return;
    }
    this.foregroundBound = true;

    onMessage(this.messaging, (payload) => {
      const title = payload.data?.['title'] ?? payload.notification?.title ?? 'NewsTracker';
      const body = payload.data?.['body'] ?? payload.notification?.body ?? '';
      const data = payload.data ?? {};
      const newsId = data['newsId'] ?? '';

      if (Notification.permission !== 'granted') {
        return;
      }

      // Use the worker registration for foreground notifications as well. It
      // is supported in more browser modes than the Notification constructor
      // and routes clicks through the same notificationclick handler used for
      // background pushes.
      const displayed = this.serviceWorkerRegistration?.showNotification(title, {
          body,
          icon: '/notification-icon.png',
          data,
          tag: newsId ? `newstracker-${newsId}` : undefined,
          // Keep the explicit test on screen until it is dismissed. This is
          // intentionally limited to synthetic tests; real market alerts keep
          // normal operating-system timing.
          requireInteraction: newsId.startsWith('push-test-'),
        });
      if (!displayed) {
        return;
      }

      void displayed
        .then(() => {
          // "Received" in the settings UI means more than an FCM callback: the
          // browser also accepted creation of the persistent notification.
          if (newsId.startsWith('push-test-')) {
            for (const notifyReceipt of this.testReceiptWaiters) {
              notifyReceipt(newsId);
            }
          }
        })
        .catch((error) => console.error('[push] foreground notification failed:', error));
    });
  }

  /** Resolve when the focused browser actually receives the synthetic FCM push. */
  private waitForTestReceipt(expectedNewsId: string, timeoutMs = 8_000): {
    promise: Promise<boolean>;
    startTimeout: () => void;
    cancel: () => void;
  } {
    let settled = false;
    let finish!: (received: boolean) => void;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const promise = new Promise<boolean>((resolve) => {
      finish = (received) => {
        if (settled) return;
        settled = true;
        if (timeoutId !== null) clearTimeout(timeoutId);
        this.testReceiptWaiters.delete(onReceipt);
        resolve(received);
      };
    });
    const onReceipt = (newsId: string) => {
      if (newsId === expectedNewsId) {
        finish(true);
      }
    };
    this.testReceiptWaiters.add(onReceipt);

    return {
      promise,
      startTimeout: () => {
        if (!settled && timeoutId === null) {
          timeoutId = setTimeout(() => finish(false), timeoutMs);
        }
      },
      cancel: () => finish(false),
    };
  }

  private createTestId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Correlation only, not authentication. This fallback covers older test
    // environments that expose Web Push but not Crypto.randomUUID().
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 18)}`;
  }
}
