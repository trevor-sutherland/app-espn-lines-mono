import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { resolveUserSports, type SportKey } from '../enums/sports.enum';

@Injectable({ providedIn: 'root' })
export class SportService {
  private readonly auth = inject(AuthService);
  sportKey = signal('americanfootball_ncaaf');

  setSportKey(key: string) {
    const allowed = resolveUserSports(this.auth.session()?.sports);
    if (!allowed.includes(key as SportKey)) return;
    this.sportKey.set(key);
  }
}