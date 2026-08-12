import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ResultsService } from './results.service';
import { IStandingRow } from './results.model';
import { DateService } from '../services/date.service';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './results.html',
  styleUrl: './results.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ResultsComponent implements OnInit {
  standings: IStandingRow[] = [];
  /** Bound as string so native <select> options work reliably. */
  season = '';
  seasons: string[] = [];
  loading = true;
  error: string | null = null;

  private readonly resultsService = inject(ResultsService);
  private readonly dateService = inject(DateService);

  ngOnInit(): void {
    const current = this.dateService.getSeasonYear();
    // Always offer current + prior seasons (includes LOTW 2025 import)
    const years = new Set<number>([current, current - 1, current - 2, 2025, 2024]);
    this.seasons = [...years].filter((y) => y >= 2024).sort((a, b) => b - a).map(String);
    // Prefer 2025 when present (imported LOTW season); else current
    this.season = this.seasons.includes('2025') ? '2025' : String(current);
    this.loadStandings();
  }

  onSeasonChange(season: string): void {
    this.season = season;
    this.loadStandings();
  }

  private loadStandings(): void {
    this.loading = true;
    this.error = null;
    const seasonNum = Number(this.season);
    this.resultsService.getStandings(seasonNum).subscribe({
      next: (res) => {
        this.standings = res.standings ?? [];
        this.loading = false;
      },
      error: () => {
        this.error = 'Could not load standings.';
        this.loading = false;
      },
    });
  }
}
