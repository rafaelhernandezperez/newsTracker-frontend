import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { AlertPrefsService } from '../../../core/services/alert-prefs.service';
import { AuthService } from '../../../core/services/auth.service';
import { PushService, type PushTestResult } from '../../../core/services/push.service';
import {
  AlertPrefs,
  UserPreferencesService,
} from '../../../core/services/user-preferences.service';
import { SettingsModalComponent } from './settings-modal';

const storedAlertPrefs = signal({ priceMoves: true, highImpact: true, dailyDigest: true });

const preferencesStub = {
  alertPrefs: storedAlertPrefs,
  setAlertPrefs: vi.fn((prefs: AlertPrefs) => storedAlertPrefs.set(prefs)),
};

const alertPrefsApiStub = {
  sync: vi.fn(async () => undefined),
};

const pushStub = {
  isCurrentDeviceRegistered: vi.fn(() => false),
  enable: vi.fn(async () => 'enabled' as const),
  unregisterCurrentDevice: vi.fn(async () => true),
  sendTestNotification: vi.fn<(language: 'en' | 'es') => Promise<PushTestResult>>(
    async () => 'received',
  ),
  showLocalPreview: vi.fn(() => true),
};

const authStub = {
  user: signal({ uid: 'user-1', email: 'reader@example.com' }),
  logout: vi.fn(async () => undefined),
};

describe('SettingsModalComponent', () => {
  let fixture: ComponentFixture<SettingsModalComponent>;
  let component: SettingsModalComponent;

  beforeEach(async () => {
    storedAlertPrefs.set({ priceMoves: true, highImpact: true, dailyDigest: true });
    preferencesStub.setAlertPrefs.mockClear();
    alertPrefsApiStub.sync.mockClear();
    pushStub.isCurrentDeviceRegistered.mockClear();
    pushStub.enable.mockClear();
    pushStub.unregisterCurrentDevice.mockClear();
    pushStub.sendTestNotification.mockClear();
    pushStub.showLocalPreview.mockClear();
    authStub.logout.mockClear();

    await TestBed.configureTestingModule({
      imports: [SettingsModalComponent],
      providers: [
        provideRouter([]),
        { provide: UserPreferencesService, useValue: preferencesStub },
        { provide: AlertPrefsService, useValue: alertPrefsApiStub },
        { provide: PushService, useValue: pushStub },
        { provide: AuthService, useValue: authStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('saves changed alert preferences to local and server state', async () => {
    const close = vi.spyOn(component.close, 'emit');

    component.toggleAlert('dailyDigest');
    await component.save();

    const expected = { priceMoves: true, highImpact: true, dailyDigest: false };
    expect(preferencesStub.setAlertPrefs).toHaveBeenCalledWith(expected);
    expect(alertPrefsApiStub.sync).toHaveBeenCalledWith(expected);
    expect(close).toHaveBeenCalledOnce();
  });

  it('starts browser notification enablement directly from the settings action', async () => {
    let finishEnable!: (result: 'enabled') => void;
    pushStub.enable.mockReturnValueOnce(
      new Promise<'enabled'>((resolve) => {
        finishEnable = resolve;
      }),
    );

    component.toggleBrowserDelivery();

    expect(pushStub.enable).toHaveBeenCalledOnce();
    expect(component.pushState()).toBe('enabling');

    finishEnable('enabled');
    await Promise.resolve();
    expect(component.pushState()).toBe('enabled');
  });

  it('logs out through settings after detaching the notification device', async () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await component.logout();

    expect(pushStub.unregisterCurrentDevice).toHaveBeenCalledOnce();
    expect(authStub.logout).toHaveBeenCalledOnce();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/login']);
  });

  it('offers a local notification preview even before FCM registration', () => {
    component.showNotificationPreview();
    fixture.detectChanges();

    expect(pushStub.showLocalPreview).toHaveBeenCalledWith(component.i18n.language());
    expect(component.testNotificationState()).toBe('previewed');
    expect(component.previewVisible()).toBe(true);
    expect(fixture.nativeElement.querySelector('.notification-preview')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Local simulation');
  });

  it('sends an end-to-end test through the backend when the device is enabled', async () => {
    component.pushState.set('enabled');

    component.sendTestNotification();
    await Promise.resolve();

    expect(pushStub.sendTestNotification).toHaveBeenCalledWith(component.i18n.language());
    expect(component.testNotificationState()).toBe('received');
  });

  it('explains when no real stored story is available for the test', async () => {
    pushStub.sendTestNotification.mockResolvedValueOnce('no-news');
    component.pushState.set('enabled');

    component.sendTestNotification();
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.testNotificationState()).toBe('no-news');
    expect(fixture.nativeElement.textContent).toContain('No stored company story');
  });
});
