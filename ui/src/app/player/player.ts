import { Component, OnInit, inject, ChangeDetectionStrategy, effect } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PlayerProfile, ScoreboardApiService } from '../services/scoreboard.service';
import { DateService } from '../services/date.service';
import { SportService } from '../services/sport.service';
import { SPORT_OPTIONS } from '../enums/sports.enum';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './player.html',
  styleUrl: './player.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class PlayerComponent implements OnInit {
  profile: PlayerProfile | null = null;
  loading = true;
  error: string | null = null;

  private readonly api = inject(ScoreboardApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly dateService = inject(DateService);
  private readonly sportService = inject(SportService);
  private userId: string | null = null;

  constructor() {
    effect(() => {
      this.sportService.sportKey();
      if (this.userId) {
        this.loadProfile(this.userId);
      }
    });
  }

  get sportLabel(): string {
    const key = this.sportService.sportKey();
    return SPORT_OPTIONS.find((option) => option.key === key)?.label ?? key;
  }

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('userId');
    if (!this.userId) {
      this.error = 'Player not found.';
      this.loading = false;
      return;
    }
    this.loadProfile(this.userId);
  }

  private loadProfile(userId: string): void {
    this.loading = true;
    this.error = null;
    this.api
      .getPlayer(
        userId,
        this.dateService.getSeasonYear(),
        this.sportService.sportKey(),
      )
      .subscribe({
        next: (res) => {
          this.profile = res;
          this.loading = false;
        },
        error: (err: HttpErrorResponse) => {
          this.error = err.error?.message || 'Could not load this player.';
          this.loading = false;
        },
      });
  }

  resultLabel(status: string): string {
    if (status === 'won') return 'Win';
    if (status === 'lost') return 'Loss';
    if (status === 'void') return 'Push';
    return 'Open';
  }

  resultClass(status: string): string {
    if (status === 'won') return 'is-win';
    if (status === 'lost') return 'is-loss';
    if (status === 'void') return 'is-push';
    return 'is-open';
  }

  pointsLabel(points: number, status: string): string {
    if (status === 'pending') return '—';
    if (points > 0) return `+${points}`;
    return String(points);
  }
}
