import { inject, Injectable } from '@angular/core';
import { IPickSummary } from './picks-summary.model';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class PicksSummaryService {
  http = inject(HttpClient);
  private auth = inject(AuthService);

  getPicksSummary(): Observable<IPickSummary[]> {
    return this.http.get<IPickSummary[]>(`${environment.apiBaseUrl}/picks/all`, {
      headers: this.auth.authHeaders(),
    });
  }

  undoPick(pickId: string): Observable<{ undone: boolean }> {
    return this.http.delete<{ undone: boolean }>(
      `${environment.apiBaseUrl}/picks/${encodeURIComponent(pickId)}`,
      { headers: this.auth.authHeaders() },
    );
  }

  sendSummaryEmail(): Observable<{ queued: boolean }> {
    return this.http.post<{ queued: boolean }>(
      `${environment.apiBaseUrl}/picks/summary-email/test`,
      {},
      { headers: this.auth.authHeaders() },
    );
  }
}
