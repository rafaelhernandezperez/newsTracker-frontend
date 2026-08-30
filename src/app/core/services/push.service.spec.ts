import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Mock } from 'vitest';

const messagingMocks = vi.hoisted(() => ({
  getMessaging: vi.fn(() => ({ name: 'messaging' })),
  getToken: vi.fn(),
  isSupported: vi.fn(),
  onMessage: vi.fn(),
}));

vi.mock('firebase/messaging', () => messagingMocks);

import { firebaseVapidKey } from '../firebase/firebase.config';
import { PushService } from './push.service';

describe('PushService', () => {
  let service: PushService;
  let http: HttpTestingController;
  let permission: NotificationPermission;
  let requestPermission: Mock<() => Promise<NotificationPermission>>;
  let registerWorker: Mock<(path: string) => Promise<ServiceWorkerRegistration>>;
  let notificationConstructor: Mock<(title: string, options?: NotificationOptions) => void>;

  function configureGrantedPush() {
    const showNotification = vi.fn<
      (title: string, options?: NotificationOptions) => Promise<void>
    >(async () => undefined);
    const workerRegistration = {
      scope: '/',
      showNotification,
    } as unknown as ServiceWorkerRegistration;

    permission = 'granted';
    messagingMocks.isSupported.mockResolvedValue(true);
    registerWorker.mockResolvedValue(workerRegistration);
    messagingMocks.getToken.mockResolvedValue('token'.padEnd(80, 'a'));

    return { showNotification, workerRegistration };
  }

  beforeEach(() => {
    localStorage.clear();
    permission = 'default';
    requestPermission = vi.fn<() => Promise<NotificationPermission>>();
    registerWorker = vi.fn<(path: string) => Promise<ServiceWorkerRegistration>>();
    notificationConstructor = vi.fn<(title: string, options?: NotificationOptions) => void>();

    class NotificationMock {
      static get permission(): NotificationPermission {
        return permission;
      }

      static requestPermission(): Promise<NotificationPermission> {
        return requestPermission();
      }

      constructor(title: string, options?: NotificationOptions) {
        notificationConstructor(title, options);
      }
    }

    vi.stubGlobal('Notification', NotificationMock);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register: registerWorker },
    });

    messagingMocks.getMessaging.mockClear();
    messagingMocks.getToken.mockReset();
    messagingMocks.isSupported.mockReset();
    messagingMocks.onMessage.mockReset();

    TestBed.configureTestingModule({
      providers: [PushService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PushService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
  });

  it('requests permission synchronously from the enable call', async () => {
    let resolvePermission!: (value: NotificationPermission) => void;
    requestPermission.mockReturnValue(
      new Promise<NotificationPermission>((resolve) => {
        resolvePermission = resolve;
      }),
    );

    const result = service.enable();

    // This assertion intentionally happens before awaiting anything. Moving an
    // async capability check ahead of requestPermission would regress the user
    // activation requirement and fail here.
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(messagingMocks.isSupported).not.toHaveBeenCalled();

    resolvePermission('denied');
    await expect(result).resolves.toBe('denied');
  });

  it('registers the service worker, FCM token, and authenticated API device', async () => {
    const workerRegistration = { scope: '/' } as ServiceWorkerRegistration;
    requestPermission.mockResolvedValue('granted');
    messagingMocks.isSupported.mockResolvedValue(true);
    registerWorker.mockResolvedValue(workerRegistration);
    messagingMocks.getToken.mockResolvedValue('token'.padEnd(80, 'a'));

    const result = service.enable();
    await settlePromises();

    const request = http.expectOne('/api/devices');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      token: 'token'.padEnd(80, 'a'),
      platform: 'web',
    });
    request.flush({ ok: true });

    await expect(result).resolves.toBe('enabled');
    expect(registerWorker).toHaveBeenCalledWith('/firebase-messaging-sw.js');
    expect(messagingMocks.getToken).toHaveBeenCalledWith(expect.anything(), {
      vapidKey: firebaseVapidKey,
      serviceWorkerRegistration: workerRegistration,
    });
    expect(messagingMocks.onMessage).toHaveBeenCalledOnce();
  });

  it('does no registration work when permission is denied', async () => {
    permission = 'denied';

    await expect(service.enable()).resolves.toBe('denied');

    expect(requestPermission).not.toHaveBeenCalled();
    expect(messagingMocks.isSupported).not.toHaveBeenCalled();
    expect(registerWorker).not.toHaveBeenCalled();
    expect(messagingMocks.getToken).not.toHaveBeenCalled();
  });

  it('never prompts while silently refreshing a returning session', async () => {
    permission = 'default';

    await expect(service.refreshIfGranted()).resolves.toBe('dismissed');

    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('removes the registered device from the account on logout', async () => {
    const token = `logout:${'a'.repeat(72)}`;
    localStorage.setItem('nt.fcmToken', token);

    const result = service.unregisterCurrentDevice();
    await settlePromises();

    const request = http.expectOne(`/api/devices/${encodeURIComponent(token)}`);
    expect(request.request.method).toBe('DELETE');
    request.flush({ ok: true });

    await expect(result).resolves.toBe(true);
    expect(localStorage.getItem('nt.fcmToken')).toBeNull();
  });

  it('verifies a correlated real-story test after creating a persistent notification', async () => {
    const { showNotification } = configureGrantedPush();
    const result = service.sendTestNotification('es');
    await settlePromises();

    const registrationRequest = http.expectOne('/api/devices');
    registrationRequest.flush({ ok: true });
    await settlePromises();

    const request = http.expectOne('/api/devices/test');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.language).toBe('es');
    expect(request.request.body.testId).toMatch(/^[A-Za-z0-9_-]{16,80}$/);
    const expectedNewsId = `push-test-${request.request.body.testId}`;
    request.flush({
      ok: true,
      sent: 1,
      failed: 0,
      sample: {
        ticker: 'BAC',
        title: 'Bank of America (BAC)',
        body: 'La SEC acusó a un exbanquero por uso de información privilegiada.',
      },
    });

    const calls = messagingMocks.onMessage.mock.calls as unknown as Array<
      [unknown, (payload: { data?: Record<string, string> }) => void]
    >;
    calls[0][1]({
      data: {
        ticker: 'BAC',
        title: 'Bank of America (BAC)',
        body: 'La SEC acusó a un exbanquero por uso de información privilegiada.',
        newsId: expectedNewsId,
        link: 'https://example.com/real-story',
      },
    });
    await settlePromises();

    await expect(result).resolves.toBe('received');
    expect(showNotification).toHaveBeenCalledWith(
      'Bank of America (BAC)',
      expect.objectContaining({
        body: 'La SEC acusó a un exbanquero por uso de información privilegiada.',
        icon: '/notification-icon.png',
        tag: `newstracker-${expectedNewsId}`,
        requireInteraction: true,
      }),
    );
  });

  it('distinguishes an empty news store from a missing device', async () => {
    configureGrantedPush();
    const result = service.sendTestNotification('en');
    await settlePromises();

    http.expectOne('/api/devices').flush({ ok: true });
    await settlePromises();
    http.expectOne('/api/devices/test').flush(
      { ok: false, code: 'no-news' },
      { status: 409, statusText: 'Conflict' },
    );

    await expect(result).resolves.toBe('no-news');
  });

  it('can display a clearly local notification preview for screenshots', () => {
    permission = 'granted';

    expect(service.showLocalPreview('es')).toBe(true);
    expect(notificationConstructor).toHaveBeenCalledWith(
      'Bank of America (BAC)',
      expect.objectContaining({
        body: 'La SEC acusó a un exbanquero de Bank of America por filtraciones que presuntamente generaron 18,5 millones de dólares en beneficios ilegales.',
        icon: '/notification-icon.png',
        requireInteraction: true,
      }),
    );
  });
});

async function settlePromises(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}
