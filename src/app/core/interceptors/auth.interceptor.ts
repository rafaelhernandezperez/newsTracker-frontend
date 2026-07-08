import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Attaches `Authorization: Bearer <idToken>` to every backend request
 * (relative `/api/*` URLs) when a user is signed in. The relative-prefix match
 * guarantees third-party absolute URLs never receive tokens. Requests made
 * while logged out pass through unchanged.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) {
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
