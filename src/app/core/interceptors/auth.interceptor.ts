import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { getAppCheckToken } from '../firebase/firebase.config';

/**
 * Attach credentials only to relative backend URLs under /api/, so neither the
 * ID token nor the App Check token can leak to a third-party host.
 *
 * Two different questions travel together: the Authorization header says who
 * the user is, and X-Firebase-AppCheck says the request came from this app
 * rather than a script. Either may be absent — signed out, or App Check not
 * configured — and the backend decides what to do about it.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) {
    return next(req);
  }

  const authService = inject(AuthService);

  const credentials = Promise.all([authService.getIdToken(), getAppCheckToken()]);

  return from(credentials).pipe(
    switchMap(([idToken, appCheckToken]) => {
      const headers: Record<string, string> = {};
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }
      if (appCheckToken) {
        headers['X-Firebase-AppCheck'] = appCheckToken;
      }

      return next(Object.keys(headers).length ? req.clone({ setHeaders: headers }) : req);
    }),
  );
};
