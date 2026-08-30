import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IPickSummary } from './picks-summary.model';
import { DateService } from '../services/date.service';
import { PicksSummaryService } from './picks-summary.service';
import { formatPickLabel } from '../helpers/pick-label';

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
  selectedWeek = 1;
  /** Bound as string so native <select> options work reliably. */
  selectedSeason = '';
  seasons: string[] = [];
  maxWeeks = 18;

  private dateService = inject(DateService);
  private picksService = inject(PicksSummaryService);
  currentWeek = 1;

  ngOnInit() {
    const current = this.dateService.getSeasonYear();
    const years = new Set<number>([current, current - 1, current - 2, 2025, 2024]);
    this.seasons = [...years]
      .filter((y) => y >= 2024)
      .sort((a, b) => b - a)
      .map(String);
    this.selectedSeason = this.seasons.includes('2025') ? '2025' : String(current);

    this.currentWeek = this.dateService.currentWeek();
    this.maxWeeks = this.dateService.getMaxWeeks();
    this.selectedWeek = this.currentWeek;

    this.picksService.getPicksSummary().subscribe((data) => {
      this.picks = data;
      this.applyFilters();
    });
  }

  onSeasonChange(season: string) {
    this.selectedSeason = season;
    this.applyFilters();
  }

  onWeekChange(week: string | number) {
    this.selectedWeek = typeof week === 'string' ? parseInt(week, 10) : week;
    this.applyFilters();
  }

  pickLabel(pick: IPickSummary): string {
    return formatPickLabel(pick.team, pick.line, pick.market);
  }

  applyFilters() {
    const seasonNum = Number(this.selectedSeason);
    this.filteredPicks = this.picks.filter(
      (pick) => pick.season === seasonNum && pick.week === this.selectedWeek,
    );
  }
}
