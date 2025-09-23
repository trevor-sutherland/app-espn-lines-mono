import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SportService {
  sportKey = signal('americanfootball_ncaaf'); // default value

  setSportKey(key: string) {
    this.sportKey.set(key);
  }
}