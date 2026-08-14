// import { Injectable } from '@angular/core';
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IOdds } from '../models/odds.model';
import { environment } from '../../environments/environment';


@Injectable({ providedIn: 'root' })
export class NflOddsService {
  private sportsKey: string;
  private baseUrl = `${environment.apiBaseUrl}/odds`;
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
