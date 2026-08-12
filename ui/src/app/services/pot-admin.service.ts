import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export type PotMember = {
  userId: string;
  email: string;
  displayName: string;
  paid: boolean;
  paidAt?: string;
};

export type SeasonPotView = {
  season: number;
  potAmount: number;
  adminFeePercent: number;
  adminFeeAmount: number;
  totalCollect: number;
  shareAmount: number;
  paidCount: number;
  memberCount: number;
  members: PotMember[];
};

@Injectable({ providedIn: 'root' })
export class PotAdminService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private baseUrl = 'http://localhost:3000/api/pot';

  get(season: number): Observable<SeasonPotView> {
    return this.http.get<SeasonPotView>(this.baseUrl, {
      params: { season: String(season) },
      headers: this.auth.authHeaders(),
    });
  }

  setSettings(
    season: number,
    potAmount: number,
    adminFeePercent: number,
  ): Observable<SeasonPotView> {
    return this.http.patch<SeasonPotView>(
      `${this.baseUrl}/${season}/settings`,
      { potAmount, adminFeePercent },
      { headers: this.auth.authHeaders() },
    );
  }

  setPaid(
    season: number,
    userId: string,
    paid: boolean,
  ): Observable<SeasonPotView> {
    return this.http.patch<SeasonPotView>(
      `${this.baseUrl}/${season}/users/${userId}/paid`,
      { paid },
      { headers: this.auth.authHeaders() },
    );
  }
}
