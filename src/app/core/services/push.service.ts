import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';
import { getFirebaseApp, firebaseVapidKey } from '../firebase/firebase.config';

const STORED_FCM_TOKEN = 'nt.fcmToken';

export type PushEnableResult = 'enabled' | 'denied' | 'dismissed' | 'unsupported' | 'failed';
export type PushTestResult = 'received' | 'sent' | 'no-device' | 'no-news' | 'failed';

@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly http = inject(HttpClient);
  private messaging: Messaging | null = null;
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private foregroundBound = false;
  private registeredToken: string | null = this.readStoredToken();
  private refreshPromise: Promise<PushEnableResult> | null = null;
  private readonly testReceiptWaiters = new Set<(newsId: string) => void>();

  enable(): Promise<PushEnableResult> {
    if (!this.hasBrowserPushApis()) {
      return Promise.resolve('unsupported');
    }

    // Call requestPermission() before any await to preserve the browser’s user activation.
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

  /** Refresh rotating FCM tokens only when notification permission is already granted. */
  refreshIfGranted(): Promise<PushEnableResult> {
    if (!this.hasBrowserPushApis()) {
      return Promise.resolve('unsupported');
    }
    if (Notification.permission !== 'granted') {
      return Promise.resolve(Notification.permission === 'denied' ? 'denied' : 'dismissed');
    }
    // Share concurrent refresh attempts so tests wait for the foreground listener.
    this.refreshPromise ??= this.registerAfterPermission(Promise.resolve('granted'), false).finally(
      () => {
        this.refreshPromise = null;
      },
    );
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

      // Bind the foreground listener before token and API work so early pushes are captured.
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
        // Keep the device unregistered even if local storage is unavailable.
      }
      return true;
    } catch (error) {
      console.error('[push] device unregister failed:', error);
      return false;
    }
  }

  isCurrentDeviceRegistered(): boolean {
    return Boolean(this.registeredToken ?? this.readStoredToken());
  }

  async sendTestNotification(language: 'en' | 'es'): Promise<PushTestResult> {
    // Attach the foreground listener before the backend sends the test notification.
    const readiness = await this.refreshIfGranted();
    if (readiness !== 'enabled') {
      return readiness === 'dismissed' || readiness === 'denied' ? 'no-device' : 'failed';
    }

    const testId = this.createTestId();
    const receipt = this.waitForTestReceipt(`push-test-${testId}`);
    try {
      await firstValueFrom(this.http.post('/api/devices/test', { language, testId }));
      // Start the receipt timeout after sending; the registered waiter captures early arrivals.
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

  /** Preview native notification appearance without testing backend or FCM delivery. */
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

      // Use the worker for foreground notifications to share browser support and click routing.
      const displayed = this.serviceWorkerRegistration?.showNotification(title, {
        body,
        icon: '/notification-icon.png',
        data,
        tag: newsId ? `newstracker-${newsId}` : undefined,
        // Keep synthetic test notifications visible until dismissed.
        requireInteraction: newsId.startsWith('push-test-'),
      });
      if (!displayed) {
        return;
      }

      void displayed
        .then(() => {
          // Report receipt only after the browser accepts the persistent notification.
          if (newsId.startsWith('push-test-')) {
            for (const notifyReceipt of this.testReceiptWaiters) {
              notifyReceipt(newsId);
            }
          }
        })
        .catch((error) => console.error('[push] foreground notification failed:', error));
    });
  }

  private waitForTestReceipt(
    expectedNewsId: string,
    timeoutMs = 8_000,
  ): {
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
    // This fallback ID correlates tests and is not used for authentication.
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 18)}`;
  }
}
