import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging';
import { getFirebaseApp, firebaseVapidKey } from '../firebase/firebase.config';

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
  private foregroundBound = false;

  /**
   * Enable push for the current (already authenticated) user. Safe to call more
   * than once; returns true if a token was registered.
   */
  async enable(): Promise<boolean> {
    try {
      if (!(await isSupported())) {
        console.warn('[push] FCM not supported in this browser');
        return false;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('[push] notification permission not granted:', permission);
        return false;
      }

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      this.messaging ??= getMessaging(getFirebaseApp());

      const token = await getToken(this.messaging, {
        vapidKey: firebaseVapidKey,
        serviceWorkerRegistration: registration,
      });

      if (!token) {
        console.warn('[push] empty FCM token');
        return false;
      }

      await firstValueFrom(
        this.http.post('/api/devices', { token, platform: 'web' }),
      );

      this.bindForegroundMessages();
      return true;
    } catch (error) {
      console.error('[push] enable failed:', error);
      return false;
    }
  }

  /** Show foreground pushes as native notifications (SW handles background). */
  private bindForegroundMessages(): void {
    if (this.foregroundBound || !this.messaging) {
      return;
    }
    this.foregroundBound = true;

    onMessage(this.messaging, (payload) => {
      const title = payload.notification?.title ?? 'NewsTracker';
      const body = payload.notification?.body ?? '';
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    });
  }
}
