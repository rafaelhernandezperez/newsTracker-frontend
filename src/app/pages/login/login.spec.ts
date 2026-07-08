import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';

import { Login } from './login';
import { AuthService } from '../../core/services/auth.service';
import { PushService } from '../../core/services/push.service';
import { WatchlistService } from '../../core/services/watchlist.service';

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
  enable: async () => false,
};

const watchlistServiceStub = {
  fetch: async () => [],
  sync: async () => undefined,
};

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: AuthService, useValue: authServiceStub },
        { provide: PushService, useValue: pushServiceStub },
        { provide: WatchlistService, useValue: watchlistServiceStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
