import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService, UserRole } from './auth.service';
import { environment } from '../../environments/environment';

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  approved: boolean;
  active: boolean;
  sports: string[];
  createdAt?: string;
};

@Injectable({ providedIn: 'root' })
export class UsersAdminService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private baseUrl = `${environment.apiBaseUrl}/users`;

  listUsers(): Observable<{ users: AdminUser[] }> {
    return this.http.get<{ users: AdminUser[] }>(this.baseUrl, {
      headers: this.auth.authHeaders(),
    });
  }

  createUser(payload: {
    email: string;
    password: string;
    displayName: string;
    sports: string[];
  }): Observable<AdminUser> {
    return this.http.post<AdminUser>(this.baseUrl, payload, {
      headers: this.auth.authHeaders(),
    });
  }

  updateUser(
    userId: string,
    payload: { email: string; displayName: string; password?: string; sports: string[] },
  ): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.baseUrl}/${userId}`, payload, {
      headers: this.auth.authHeaders(),
    });
  }

  approve(userId: string): Observable<AdminUser> {
    return this.http.patch<AdminUser>(
      `${this.baseUrl}/${userId}/approve`,
      {},
      { headers: this.auth.authHeaders() },
    );
  }

  deny(userId: string): Observable<AdminUser> {
    return this.http.patch<AdminUser>(
      `${this.baseUrl}/${userId}/deny`,
      {},
      { headers: this.auth.authHeaders() },
    );
  }

  setRole(userId: string, role: UserRole): Observable<AdminUser> {
    return this.http.patch<AdminUser>(
      `${this.baseUrl}/${userId}/role`,
      { role },
      { headers: this.auth.authHeaders() },
    );
  }

  setActive(userId: string, active: boolean): Observable<AdminUser> {
    return this.http.patch<AdminUser>(
      `${this.baseUrl}/${userId}/active`,
      { active },
      { headers: this.auth.authHeaders() },
    );
  }
}
