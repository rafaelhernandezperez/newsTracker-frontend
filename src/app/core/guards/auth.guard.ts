import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Blocks the portfolio views until Firebase resolves the session, then lets
 * signed-in users through and sends everyone else to the login screen.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return toObservable(auth.ready).pipe(
    filter(Boolean),
    take(1),
    map(() => (auth.isAuthenticated ? true : router.createUrlTree(['/login']))),
  );
};

/**
 * Reverse guard for the login screen: users who are already signed in are sent
 * straight to their portfolio instead of seeing the login form again.
 */
export const loginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return toObservable(auth.ready).pipe(
    filter(Boolean),
    take(1),
    map(() => (auth.isAuthenticated ? router.createUrlTree(['/portfolio']) : true)),
  );
};
