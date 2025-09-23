// import { Injectable } from '@angular/core';
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IOdds } from '../models/odds.model';


@Injectable({ providedIn: 'root' })
export class NflOddsService {
  private sportsKey: string;
  private baseUrl = 'http://localhost:3000/api/odds';
  private http = inject(HttpClient);

  getCurrentWeekOdds(sportsKey: string): Observable<IOdds[]> {
    const url = `${this.baseUrl}/all`;
    this.sportsKey = sportsKey;
    return this.http.post<IOdds[]>(url, {
       sportKey: this.sportsKey
      });
  }

  getFreshOdds(sportKey: string): Observable<IOdds[]> {
    const url = `${this.baseUrl}/current-week/save`;
    return this.http.post<IOdds[]>(url, { sportKey });
  }
}
