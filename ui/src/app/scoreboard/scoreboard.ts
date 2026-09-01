import { Component, inject, ChangeDetectionStrategy, effect } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ScoreboardApiService,
  ScoreboardResponse,
  ScoreboardRow,
} from '../services/scoreboard.service';
import { DateService } from '../services/date.service';
import { SportService } from '../services/sport.service';
import { SPORT_OPTIONS } from '../enums/sports.enum';
import { formatSignedLine } from '../helpers/pick-label';

@Component({
  selector: 'app-scoreboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './scoreboard.html',
  styleUrl: './scoreboard.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ScoreboardComponent {
  data: ScoreboardResponse | null = null;
  loading = true;
  error: string | null = null;
  mobilePanel: 'picks' | 'activity' | null = null;

  private readonly api = inject(ScoreboardApiService);
  private readonly dateService = inject(DateService);
  private readonly router = inject(Router);
  readonly sportService = inject(SportService);

  constructor() {
    effect(() => {
      this.sportService.sportKey();
      this.dateService.recomputeSeasonAndWeek();
      this.mobilePanel = null;
      this.load();
    });
  }

  get sportLabel(): string {
    const key = this.sportService.sportKey();
    return SPORT_OPTIONS.find((option) => option.key === key)?.label ?? key;
  }

  get podium(): ScoreboardRow[] {
    return this.data?.standings.slice(0, 3) ?? [];
  }

  podiumAt(place: 1 | 2 | 3): ScoreboardRow | null {
    return this.podium[place - 1] ?? null;
  }

  formatDelta(delta: number | null): string {
    if (delta == null || delta === 0) return '—';
    return delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`;
  }

  deltaClass(delta: number | null): string {
    if (delta == null || delta === 0) return 'rank-flat';
    return delta > 0 ? 'rank-up' : 'rank-down';
  }

  weeklyPointsLabel(points: number): string {
    if (points > 0) return `+${points}`;
    return String(points);
  }

  biggestWinnerMargin(): string {
    return this.data?.biggestWinner
      ? formatSignedLine(this.data.biggestWinner.margin)
      : '';
  }

  toggleMobilePanel(panel: 'picks' | 'activity'): void {
    this.mobilePanel = this.mobilePanel === panel ? null : panel;
  }

  rankMedal(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  }

  openPlayer(userId: string): void {
    void this.router.navigate(['/players', userId]);
  }

  onRowKey(event: KeyboardEvent, userId: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openPlayer(userId);
    }
  }

  private load(): void {
    this.loading = true;
    this.error = null;
    this.api
      .getScoreboard(
        this.dateService.getSeasonYear(),
        this.sportService.sportKey(),
      )
      .subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.error =
          err.error?.message || 'Could not load the scoreboard.';
        this.loading = false;
      },
    });
  }
}
