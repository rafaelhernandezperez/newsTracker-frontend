import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';

import { Login } from './login';
import { AuthService } from '../../core/services/auth.service';
import { PushService } from '../../core/services/push.service';
import { WatchlistService } from '../../core/services/watchlist.service';
import { AlertPrefsService } from '../../core/services/alert-prefs.service';

/** Minimal AuthService fake: no Firebase, nobody signed in. */
const authServiceStub = {
  user: signal(null),
  ready: signal(true),
  isAuthenticated: false,
  login: async () => ({}),
  register: async () => ({}),
  logout: async () => undefined,
  getIdToken: async () => null,
};

const pushServiceStub = {
  enable: vi.fn(async () => 'enabled' as const),
};

const watchlistServiceStub = {
  fetch: vi.fn(async () => []),
  sync: vi.fn(async () => undefined),
};

const alertPrefsServiceStub = {
  fetch: vi.fn(async () => ({ priceMoves: true, highImpact: true, dailyDigest: true })),
  sync: vi.fn(async () => undefined),
};

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    pushServiceStub.enable.mockClear();
    watchlistServiceStub.fetch.mockClear();
    watchlistServiceStub.sync.mockReset().mockResolvedValue(undefined);
    alertPrefsServiceStub.fetch.mockClear();
    alertPrefsServiceStub.sync.mockReset().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: AuthService, useValue: authServiceStub },
        { provide: PushService, useValue: pushServiceStub },
        { provide: WatchlistService, useValue: watchlistServiceStub },
        { provide: AlertPrefsService, useValue: alertPrefsServiceStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts push permission before awaiting onboarding API work', async () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    let finishWatchlistSync!: () => void;
    watchlistServiceStub.sync.mockReturnValueOnce(
      new Promise<undefined>((resolve) => {
        finishWatchlistSync = () => resolve(undefined);
      }),
    );

    const view = component as unknown as {
      screen: { set(value: string): void };
      currentStep: { set(value: number): void };
      continue(): Promise<void>;
    };
    view.screen.set('wizard');
    view.currentStep.set(1);

    const finishing = view.continue();

    expect(pushServiceStub.enable).toHaveBeenCalledOnce();
    expect(watchlistServiceStub.sync).toHaveBeenCalledOnce();

    finishWatchlistSync();
    await finishing;
  });
});
