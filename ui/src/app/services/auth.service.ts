import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { LoginResponse } from '../login/login-response.interface';

export type UserRole = 'user' | 'admin';

export type JwtUser = {
  userId: string;
  email: string;
  role: UserRole;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = 'http://localhost:3000/api/auth';
  private readonly tokenKey = 'jwtToken';

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

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.session.set(null);
    this.router.navigate(['/login']);
  }

  private readSession(): JwtUser | null {
    const token = localStorage.getItem(this.tokenKey);
    return token ? this.decodeToken(token) : null;
  }

  private decodeToken(token: string): JwtUser | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as {
        sub?: string;
        email?: string;
        role?: UserRole;
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
      };
    } catch {
      return null;
    }
  }
}
