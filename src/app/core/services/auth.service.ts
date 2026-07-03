import { Injectable, signal } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { AUTH_DISABLED, getFirebaseApp } from '../firebase/firebase.config';

/** Stand-in user while AUTH_DISABLED (see firebase.config.ts). */
const DEV_USER = {
  uid: 'dev-user',
  email: 'dev@local',
  displayName: 'Dev User',
} as unknown as User;

/**
 * Wraps Firebase Authentication. Exposes the current user as a signal so views
 * react to login/logout, and hands out fresh ID tokens for authenticated API
 * calls (watchlist, devices).
 *
 * While AUTH_DISABLED, Firebase is never touched: any credentials "log in" as
 * a fixed dev user and no ID token is sent (the backend accepts that in its
 * own AUTH_DISABLED mode).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth: Auth | null = AUTH_DISABLED ? null : getAuth(getFirebaseApp());

  /** Current signed-in user (null when logged out). */
  readonly user = signal<User | null>(AUTH_DISABLED ? DEV_USER : null);
  /** True once Firebase has resolved the initial auth state. */
  readonly ready = signal(AUTH_DISABLED);

  constructor() {
    if (!this.auth) {
      return;
    }
    onAuthStateChanged(this.auth, (user) => {
      this.user.set(user);
      this.ready.set(true);
    });
  }

  get isAuthenticated(): boolean {
    return this.user() !== null;
  }

  async register(fullName: string, email: string, password: string): Promise<User> {
    if (!this.auth) {
      return DEV_USER;
    }
    const credential = await createUserWithEmailAndPassword(this.auth, email, password);
    if (fullName.trim()) {
      await updateProfile(credential.user, { displayName: fullName.trim() });
    }
    return credential.user;
  }

  async login(email: string, password: string): Promise<User> {
    if (!this.auth) {
      return DEV_USER;
    }
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    return credential.user;
  }

  async logout(): Promise<void> {
    if (!this.auth) {
      return;
    }
    await signOut(this.auth);
  }

  /** Fresh Firebase ID token for the Authorization header, or null if logged out. */
  async getIdToken(): Promise<string | null> {
    if (!this.auth) {
      return null;
    }
    const user = this.auth.currentUser;
    return user ? user.getIdToken() : null;
  }
}
