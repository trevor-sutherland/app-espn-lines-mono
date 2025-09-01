import { Injectable } from '@angular/core';
// import { inject, Injectable } from '@angular/core';
// import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

export interface NflOdds {
  sport: string;
  eventId: string;
  commenceTime: string;
  bookmakerKey: string;
  bookmakerTitle: string;
  market: string;
  selection: string;
  team?: string;
  line: number | null;
  price: number;
  lastUpdate: string;
}

@Injectable({ providedIn: 'root' })
export class NflOddsService {
  // private apiUrl = 'http://localhost:3000/odds/nfl/current-week';
  // private http = inject(HttpClient);

  getCurrentWeekOdds(): Observable<NflOdds[]> {
    return of('hello') as unknown as Observable<NflOdds[]>;
    // return this.http.get<NflOdds[]>(this.apiUrl);
  }
}
// export class NflOddsService {
//   private sportsService = inject(SportService);
//   private apiUrl = 'http://localhost:3000/api/odds/current-week';
//   private http = inject(HttpClient);
//   sportsKey = 'americanfootball_ncaaf';

//   getCurrentWeekOdds(): Observable<NflOdds[]> {
//     this.sportsKey = this.sportsService.sportKey();
//     console.log(this.sportsService.sportKey());
//     return this.http.post<NflOdds[]>(this.apiUrl, {
//        sportKey: this.sportsKey
//       });
//   }
// }
