import { inject, Injectable } from '@angular/core';
import { IPickSummary } from './picks-summary.model';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PicksSummaryService {
  http = inject(HttpClient);

  getPicksSummary(): Observable<IPickSummary[]> {
        return this.http.get<IPickSummary[]>(`${environment.apiBaseUrl}/picks/all`);
  }
}
