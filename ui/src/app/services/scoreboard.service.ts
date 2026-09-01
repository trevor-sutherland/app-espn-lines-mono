import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export type ScoreboardRow = {
  userId: string;
  displayName: string;
  rank: number;
  rankDelta: number | null;
  points: number;
  wins: number;
  losses: number;
  voids: number;
  record: string;
  currentWeekPick: string | null;
  currentWeekLoy: boolean;
  loneWolf: boolean;
  streak: string;
  loyUsed: boolean;
  loyWeek: number | null;
  weeklyPoints: number;
};

export type TopPickRow = {
  label: string;
  count: number;
  pct: number;
};

export type WeeklyLeader = {
  userId: string;
  displayName: string;
  points: number;
};

export type ActivityItem = {
  at: string;
  text: string;
};

export type BiggestWinner = {
  margin: number;
  winners: { userId: string; displayName: string }[];
};

export type ScoreboardResponse = {
  season: number;
  week: number;
  rangeLabel: string;
  standings: ScoreboardRow[];
  topPicks: TopPickRow[];
  weeklyLeaders: WeeklyLeader[];
  activity: ActivityItem[];
  submittedCount: number;
  biggestWinner: BiggestWinner | null;
};

export type PlayerHistoryPick = {
  week: number;
  label: string;
  loy: boolean;
  status: string;
  points: number;
};

export type PlayerProfile = {
  userId: string;
  displayName: string;
  season: number;
  week: number;
  points: number;
  record: string;
  wins: number;
  losses: number;
  voids: number;
  streak: string;
  bestWinStreak: string;
  spreadRecord: string;
  totalsRecord: string;
  loyUsed: boolean;
  loyWeek: number | null;
  loyRecord: string | null;
  history: PlayerHistoryPick[];
};

@Injectable({ providedIn: 'root' })
export class ScoreboardApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = `${environment.apiBaseUrl}/scoreboard`;

  getScoreboard(season: number | undefined, sportKey: string): Observable<ScoreboardResponse> {
    const params: Record<string, string> = { sportKey };
    if (season != null) params['season'] = String(season);
    return this.http.get<ScoreboardResponse>(this.baseUrl, {
      headers: this.auth.authHeaders(),
      params,
    });
  }

  getPlayer(
    userId: string,
    season: number | undefined,
    sportKey: string,
  ): Observable<PlayerProfile> {
    const params: Record<string, string> = { sportKey };
    if (season != null) params['season'] = String(season);
    return this.http.get<PlayerProfile>(
      `${this.baseUrl}/players/${encodeURIComponent(userId)}`,
      { headers: this.auth.authHeaders(), params },
    );
  }
}
