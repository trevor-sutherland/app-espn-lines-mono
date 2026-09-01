import { Component, inject, OnInit, ChangeDetectionStrategy, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IPickSummary } from './picks-summary.model';
import { DateService } from '../services/date.service';
import { PicksSummaryService } from './picks-summary.service';
import { SportService } from '../services/sport.service';
import { AuthService } from '../services/auth.service';
import { formatPickLabel, formatSignedLine } from '../helpers/pick-label';
import { SPORT_OPTIONS } from '../enums/sports.enum';

@Component({
  selector: 'app-picks-summary',
  imports: [FormsModule],
  standalone: true,
  templateUrl: './picks-summary.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./picks-summary.scss'],
})
export class PicksSummary implements OnInit {
  picks: IPickSummary[] = [];
  filteredPicks: IPickSummary[] = [];
  /** Bound as string so native <select> options work reliably. */
  selectedWeek = '';
  /** Bound as string so native <select> options work reliably. */
  selectedSeason = '';
  seasons: string[] = [];
  maxWeeks = 18;

  private dateService = inject(DateService);
  private picksService = inject(PicksSummaryService);
  private sportService = inject(SportService);
  readonly auth = inject(AuthService);
  currentWeek = 1;
  undoTarget: IPickSummary | null = null;
  undoing = false;
  undoError: string | null = null;

  constructor() {
    this.applyCurrentSeasonAndWeek();
    effect(() => {
      this.sportService.sportKey();
      this.dateService.recomputeSeasonAndWeek();
      this.maxWeeks = this.dateService.getMaxWeeks();
      const week = Number(this.selectedWeek) || this.dateService.currentWeek();
      const nextWeek = Math.min(week, this.maxWeeks);
      this.currentWeek = this.dateService.currentWeek();
      this.selectedWeek = String(nextWeek);
      this.applyFilters();
    });
  }

  ngOnInit() {
    this.applyCurrentSeasonAndWeek();

    this.picksService.getPicksSummary().subscribe((data) => {
      this.picks = data;
      this.applyFilters();
    });
  }

  get sportLabel(): string {
    const key = this.sportService.sportKey();
    return SPORT_OPTIONS.find((option) => option.key === key)?.label ?? key;
  }

  onSeasonChange(season: string) {
    this.selectedSeason = season;
    this.applyFilters();
  }

  onWeekChange(week: string | number) {
    this.selectedWeek = String(week);
    this.applyFilters();
  }

  pickLabel(pick: IPickSummary): string {
    return formatPickLabel(pick.team, pick.line, pick.market, {
      awayTeam: pick.awayTeam,
      homeTeam: pick.homeTeam,
    });
  }

  playerName(pick: IPickSummary): string {
    return pick.userId?.displayName || 'Unknown';
  }

  marginLabel(pick: IPickSummary): string {
    if (pick.status === 'pending' || pick.margin == null || Number.isNaN(Number(pick.margin))) {
      return '—';
    }
    return formatSignedLine(pick.margin);
  }

  askUndo(pick: IPickSummary): void {
    if (!this.auth.isAdmin()) return;
    this.undoTarget = pick;
    this.undoError = null;
  }

  cancelUndo(): void {
    if (this.undoing) return;
    this.undoTarget = null;
    this.undoError = null;
  }

  confirmUndo(): void {
    if (!this.undoTarget || this.undoing) return;
    this.undoing = true;
    this.undoError = null;
    const pickId = this.undoTarget._id;
    this.picksService.undoPick(pickId).subscribe({
      next: () => {
        this.picks = this.picks.filter((pick) => pick._id !== pickId);
        this.applyFilters();
        this.undoTarget = null;
        this.undoing = false;
      },
      error: (err) => {
        this.undoError = err.error?.message || 'Could not undo this pick.';
        this.undoing = false;
      },
    });
  }

  applyFilters() {
    const seasonNum = Number(this.selectedSeason);
    const weekNum = Number(this.selectedWeek);
    const sportKey = this.sportService.sportKey();
    this.filteredPicks = this.picks.filter(
      (pick) =>
        pick.season === seasonNum &&
        pick.week === weekNum &&
        (pick.sportKey ? pick.sportKey === sportKey : sportKey === 'americanfootball_ncaaf'),
    );
  }

  private applyCurrentSeasonAndWeek(): void {
    this.dateService.recomputeSeasonAndWeek();
    const current = this.dateService.getSeasonYear();
    const years = new Set<number>([current, current - 1, current - 2, 2025, 2024]);
    this.seasons = [...years]
      .filter((y) => y >= 2024)
      .sort((a, b) => b - a)
      .map(String);
    this.selectedSeason = String(current);
    this.currentWeek = this.dateService.currentWeek();
    this.maxWeeks = this.dateService.getMaxWeeks();
    this.selectedWeek = String(this.currentWeek);
  }
}
