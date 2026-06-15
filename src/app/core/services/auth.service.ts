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
import { getFirebaseApp } from '../firebase/firebase.config';

/**
 * Wraps Firebase Authentication. Exposes the current user as a signal so views
 * react to login/logout, and hands out fresh ID tokens for authenticated API
 * calls (watchlist, devices).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth: Auth = getAuth(getFirebaseApp());

  /** Current signed-in user (null when logged out). */
  readonly user = signal<User | null>(null);
  /** True once Firebase has resolved the initial auth state. */
  readonly ready = signal(false);

  constructor() {
    onAuthStateChanged(this.auth, (user) => {
      this.user.set(user);
      this.ready.set(true);
    });
  }

  get isAuthenticated(): boolean {
    return this.user() !== null;
  }

  async register(fullName: string, email: string, password: string): Promise<User> {
    const credential = await createUserWithEmailAndPassword(this.auth, email, password);
    if (fullName.trim()) {
      await updateProfile(credential.user, { displayName: fullName.trim() });
    }
    return credential.user;
  }

  async login(email: string, password: string): Promise<User> {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    return credential.user;
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  /** Fresh Firebase ID token for the Authorization header, or null if logged out. */
  async getIdToken(): Promise<string | null> {
    const user = this.auth.currentUser;
    return user ? user.getIdToken() : null;
  }
}
