import { inject, Injectable } from '@angular/core';
import { IPickSummary } from './picks-summary.model';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PicksSummaryService {
  http = inject(HttpClient);

  getPicksSummary(): Observable<IPickSummary[]> {
        return this.http.get<IPickSummary[]>('http://localhost:3000/api/picks/all');
  }
}
