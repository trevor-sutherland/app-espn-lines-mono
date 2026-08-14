import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { IStandingRow } from './results.model';

@Injectable({ providedIn: 'root' })
export class ResultsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = `${environment.apiBaseUrl}/results`;

  getStandings(season?: number): Observable<{ standings: IStandingRow[] }> {
    const params =
      season != null ? `?season=${encodeURIComponent(String(season))}` : '';
    return this.http.get<{ standings: IStandingRow[] }>(
      `${this.baseUrl}/standings${params}`,
      { headers: this.auth.authHeaders() },
    );
  }

  syncResults(): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/sync`, {}, {
      headers: this.auth.authHeaders(),
    });
  }
}
