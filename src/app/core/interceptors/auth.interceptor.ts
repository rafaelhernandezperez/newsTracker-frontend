import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';

// Endpoints that require a Firebase ID token. /news and /market are public.
const AUTHED_PATHS = ['/api/watchlist', '/api/devices'];

/**
 * Attaches `Authorization: Bearer <idToken>` to requests against the
 * authenticated backend routes when a user is signed in.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const needsAuth = AUTHED_PATHS.some((path) => req.url.startsWith(path));

  if (!needsAuth) {
    return next(req);
  }

  const authService = inject(AuthService);

  return from(authService.getIdToken()).pipe(
    switchMap((token) => {
      const authedReq = token
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;
      return next(authedReq);
    }),
  );
};
