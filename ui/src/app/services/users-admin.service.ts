import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService, UserRole } from './auth.service';

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  approved: boolean;
  active: boolean;
  createdAt?: string;
};

@Injectable({ providedIn: 'root' })
export class UsersAdminService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private baseUrl = 'http://localhost:3000/api/users';

  listUsers(): Observable<{ users: AdminUser[] }> {
    return this.http.get<{ users: AdminUser[] }>(this.baseUrl, {
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
