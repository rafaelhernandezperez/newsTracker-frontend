import { Component, EventEmitter, HostListener, Output, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslationKey } from '../../../core/i18n/translations';
import { AlertPrefsService } from '../../../core/services/alert-prefs.service';
import { AuthService } from '../../../core/services/auth.service';
import { LanguageService } from '../../../core/services/language.service';
import { PushEnableResult, PushService } from '../../../core/services/push.service';
import {
  AlertPrefs,
  UserPreferencesService,
} from '../../../core/services/user-preferences.service';

type PushControlState = 'idle' | 'disabled' | 'enabling' | 'disabling' | PushEnableResult;

type AlertOption = {
  id: keyof AlertPrefs;
  labelKey: TranslationKey;
};

type TestNotificationState =
  | 'idle'
  | 'sending'
  | 'received'
  | 'sent'
  | 'no-device'
  | 'no-news'
  | 'failed'
  | 'previewed';

@Component({
  selector: 'app-settings-modal',
  templateUrl: './settings-modal.html',
  styleUrl: './settings-modal.css',
})
export class SettingsModalComponent {
  @Output() close = new EventEmitter<void>();

  private readonly preferences = inject(UserPreferencesService);
  private readonly alertPrefsApi = inject(AlertPrefsService);
  private readonly push = inject(PushService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly i18n = inject(LanguageService);

  readonly user = this.auth.user;
  readonly alertPrefs = signal<AlertPrefs>({ ...this.preferences.alertPrefs() });
  readonly pushState = signal<PushControlState>(this.initialPushState());
  readonly saveState = signal<'idle' | 'saving' | 'failed'>('idle');
  readonly logoutBusy = signal(false);
  readonly testNotificationState = signal<TestNotificationState>('idle');
  readonly previewVisible = signal(false);

  readonly alertOptions: AlertOption[] = [
    { id: 'priceMoves', labelKey: 'alerts.priceMoves' },
    { id: 'highImpact', labelKey: 'alerts.highImpact' },
    { id: 'dailyDigest', labelKey: 'alerts.dailyDigest' },
  ];

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.saveStateIsBusy() && !this.logoutBusy()) {
      this.close.emit();
    }
  }

  toggleAlert(id: keyof AlertPrefs): void {
    this.alertPrefs.update((prefs) => ({ ...prefs, [id]: !prefs[id] }));
    this.saveState.set('idle');
  }

  toggleBrowserDelivery(): void {
    if (this.pushState() === 'enabling' || this.pushState() === 'disabling') {
      return;
    }

    if (this.pushState() === 'enabled') {
      this.testNotificationState.set('idle');
      this.pushState.set('disabling');
      void this.push.unregisterCurrentDevice().then((removed) => {
        this.pushState.set(removed ? 'disabled' : 'failed');
      });
      return;
    }

    this.pushState.set('enabling');
    this.testNotificationState.set('idle');
    // Call enable() synchronously so the browser can show its permission prompt.
    const attempt = this.push.enable();
    void attempt.then((result) => this.pushState.set(result));
  }

  sendTestNotification(): void {
    if (this.testNotificationState() === 'sending' || this.pushState() !== 'enabled') {
      return;
    }
    this.testNotificationState.set('sending');
    void this.push.sendTestNotification(this.i18n.language()).then((result) => {
      this.testNotificationState.set(result);
    });
  }

  showNotificationPreview(): void {
    // Show an in-app preview even when the operating system suppresses native banners.
    this.previewVisible.set(true);
    this.testNotificationState.set('previewed');

    this.push.showLocalPreview(this.i18n.language());
  }

  async save(): Promise<void> {
    if (this.saveStateIsBusy()) {
      return;
    }
    this.saveState.set('saving');
    const prefs = { ...this.alertPrefs() };
    try {
      await this.alertPrefsApi.sync(prefs);
      this.preferences.setAlertPrefs(prefs);
      this.close.emit();
    } catch {
      this.saveState.set('failed');
    }
  }

  async logout(): Promise<void> {
    if (this.logoutBusy()) {
      return;
    }
    this.logoutBusy.set(true);
    await this.push.unregisterCurrentDevice();
    await this.auth.logout();
    this.close.emit();
    await this.router.navigate(['/login']);
  }

  pushStatusMessage(): string {
    switch (this.pushState()) {
      case 'enabled':
        return this.i18n.t('settings.deliveryEnabled');
      case 'disabled':
        return this.i18n.t('settings.deliveryDisabled');
      case 'enabling':
        return this.i18n.t('alerts.browserEnabling');
      case 'disabling':
        return this.i18n.t('settings.deliveryDisabling');
      case 'denied':
        return this.i18n.t('alerts.browserDenied');
      case 'dismissed':
        return this.i18n.t('alerts.browserDismissed');
      case 'unsupported':
        return this.i18n.t('alerts.browserUnsupported');
      case 'failed':
        return this.i18n.t('alerts.browserFailed');
      default:
        return this.i18n.t('settings.deliveryDisabled');
    }
  }

  testNotificationMessage(): string | null {
    switch (this.testNotificationState()) {
      case 'sending':
        return this.i18n.t('settings.testSending');
      case 'received':
        return this.i18n.t('settings.testReceived');
      case 'sent':
        return this.i18n.t('settings.testSent');
      case 'no-device':
        return this.i18n.t('settings.testNoDevice');
      case 'no-news':
        return this.i18n.t('settings.testNoNews');
      case 'failed':
        return this.i18n.t('settings.testFailed');
      case 'previewed':
        return this.i18n.t('settings.previewShown');
      default:
        return null;
    }
  }

  private initialPushState(): PushControlState {
    if (this.push.isCurrentDeviceRegistered()) {
      return 'enabled';
    }
    if (
      typeof Notification === 'undefined' ||
      typeof navigator === 'undefined' ||
      !('serviceWorker' in navigator)
    ) {
      return 'unsupported';
    }
    return Notification.permission === 'denied' ? 'denied' : 'idle';
  }

  private saveStateIsBusy(): boolean {
    return this.saveState() === 'saving';
  }
}
