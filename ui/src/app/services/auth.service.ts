import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { LoginResponse } from '../login/login-response.interface';
import { environment } from '../../environments/environment';
import { resolveUserSports, type SportKey } from '../enums/sports.enum';

export type UserRole = 'user' | 'admin';

export type JwtUser = {
  userId: string;
  email: string;
  role: UserRole;
  sports: SportKey[];
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = `${environment.apiBaseUrl}/auth`;
  private readonly tokenKey = 'jwtToken';
  private readonly lastActiveKey = 'locksOnlyLastActive';
  private readonly idleLogoutKey = 'locksOnlyIdleLogout';
  /** Log out after this much time with no clicks, keys, or scrolls. */
  static readonly IDLE_MS = 10 * 60 * 1000;

  /** Reactive session snapshot for the shell / guards. */
  readonly session = signal<JwtUser | null>(this.readSession());
  readonly isLoggedIn = computed(() => !!this.session());
  readonly isAdmin = computed(() => this.session()?.role === 'admin');

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/login`, { email, password })
      .pipe(
        tap((res) => {
          const token = res?.user?.jwtToken;
          if (token) {
            localStorage.setItem(this.tokenKey, token);
            this.touchActivity();
            this.session.set(this.decodeToken(token));
          }
        }),
      );
  }

  signup(email: string, password: string, displayName?: string): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/signup`, { email, password, displayName });
  }

  requestPasswordReset(email: string) {
    return this.http.post(`${this.apiUrl}/request-password-reset`, { email });
  }

  resetPassword(email: string, token: string, password: string) {
    return this.http.post(`${this.apiUrl}/reset-password`, { email, token, password });
  }

  getProfile(): Observable<{
    email: string;
    pendingEmail: string | null;
    displayName: string;
  }> {
    return this.http.get<{
      email: string;
      pendingEmail: string | null;
      displayName: string;
    }>(`${this.apiUrl}/me`, { headers: this.authHeaders() });
  }

  updateDisplayName(displayName: string): Observable<{ displayName: string }> {
    return this.http.patch<{ displayName: string }>(
      `${this.apiUrl}/me/display-name`,
      { displayName },
      { headers: this.authHeaders() },
    );
  }

  requestEmailChange(email: string): Observable<{
    currentEmail: string;
    pendingEmail: string;
    message: string;
  }> {
    return this.http.patch<{
      currentEmail: string;
      pendingEmail: string;
      message: string;
    }>(`${this.apiUrl}/me/email`, { email }, { headers: this.authHeaders() });
  }

  confirmEmailChange(token: string): Observable<{
    previousEmail: string;
    email: string;
    user: { jwtToken: string };
  }> {
    return this.http
      .post<{
        previousEmail: string;
        email: string;
        user: { jwtToken: string };
      }>(`${this.apiUrl}/confirm-email-change`, { token })
      .pipe(
        tap((res) => {
          const jwt = res?.user?.jwtToken;
          if (jwt) {
            localStorage.setItem(this.tokenKey, jwt);
            this.touchActivity();
            this.session.set(this.decodeToken(jwt));
          }
        }),
      );
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  authHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  logout(options?: { reason?: 'idle' | 'manual' }): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.lastActiveKey);
    if (options?.reason === 'idle') {
      sessionStorage.setItem(this.idleLogoutKey, '1');
    }
    this.session.set(null);
    this.router.navigate(['/login']);
  }

  consumeIdleLogoutNotice(): boolean {
    const shown = sessionStorage.getItem(this.idleLogoutKey) === '1';
    if (shown) sessionStorage.removeItem(this.idleLogoutKey);
    return shown;
  }

  /** Record that the user is still using the app. */
  touchActivity(): void {
    if (!this.getToken()) return;
    localStorage.setItem(this.lastActiveKey, String(Date.now()));
  }

  /**
   * End the session if the last activity is older than 10 minutes.
   * Returns true when this call logged the user out.
   */
  expireIfIdle(): boolean {
    if (!this.getToken()) return false;
    const last = Number(localStorage.getItem(this.lastActiveKey));
    if (!Number.isFinite(last)) {
      this.touchActivity();
      return false;
    }
    if (Date.now() - last > AuthService.IDLE_MS) {
      this.logout({ reason: 'idle' });
      return true;
    }
    return false;
  }

  /** Apply sports from an admin save without forcing a re-login. */
  setSessionSports(sports: string[]): void {
    const current = this.session();
    if (!current) return;
    this.session.set({ ...current, sports: resolveUserSports(sports) });
  }

  private readSession(): JwtUser | null {
    const token = localStorage.getItem(this.tokenKey);
    if (!token) return null;
    const last = Number(localStorage.getItem(this.lastActiveKey));
    if (Number.isFinite(last) && Date.now() - last > AuthService.IDLE_MS) {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.lastActiveKey);
      sessionStorage.setItem(this.idleLogoutKey, '1');
      return null;
    }
    return this.decodeToken(token);
  }

  private decodeToken(token: string): JwtUser | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as {
        sub?: string;
        email?: string;
        role?: UserRole;
        sports?: string[];
        exp?: number;
      };
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem(this.tokenKey);
        return null;
      }
      if (!payload.sub || !payload.email) return null;
      return {
        userId: payload.sub,
        email: payload.email,
        role: payload.role === 'admin' ? 'admin' : 'user',
        sports: resolveUserSports(payload.sports),
      };
    } catch {
      return null;
    }
  }
}
