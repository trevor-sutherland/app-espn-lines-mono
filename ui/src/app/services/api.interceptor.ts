import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, retry, throwError, timer } from 'rxjs';
import { AuthService } from './auth.service';

const AUTH_SKIP_401 = [
  '/auth/login',
  '/auth/signup',
  '/auth/request-password-reset',
  '/auth/reset-password',
];

/** Retry Cloud Run 503s (Mongo still connecting) and drop a stale JWT on 401. */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  return next(req).pipe(
    retry({
      count: 4,
      delay: (error: HttpErrorResponse, retryCount) => {
        if (error.status !== 503) {
          return throwError(() => error);
        }
        return timer(Math.min(1500 * retryCount, 6000));
      },
    }),
    catchError((error: HttpErrorResponse) => {
      const skip401 = AUTH_SKIP_401.some((path) => req.url.includes(path));
      if (error.status === 401 && !skip401 && auth.isLoggedIn()) {
        auth.logout();
      }
      return throwError(() => error);
    }),
  );
};
