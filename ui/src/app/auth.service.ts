import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LoginResponse } from './interfaces/login-response.interface';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api/auth';

  login(email: string, password: string): Observable<LoginResponse> {
    console.log(`${this.apiUrl}/login`);
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password });
  }

  signup(email: string, password: string, displayName?: string): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/signup`, { email, password, displayName });
  }

  requestPasswordReset(email: string) {
    return this.http.post('http://localhost:3000/api/auth/request-password-reset', { email });
  }

  resetPassword(email: string, token: string, password: string) {
    return this.http.post('http://localhost:3000/api/auth/reset-password', { email, token, password });
  }
}
