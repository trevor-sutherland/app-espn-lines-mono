import {
  Component,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SportService } from '../services/sport.service';
import { NflOddsService } from '../services/sport-odds-service';
import { ResultsService } from '../results/results.service';
import { SportsEnum } from '../enums/sports.enum';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './nav.html',
  styleUrl: './nav.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class NavComponent {
  readonly auth = inject(AuthService);
  readonly sportService = inject(SportService);
  private readonly oddsService = inject(NflOddsService);
  private readonly resultsService = inject(ResultsService);

  refreshing = false;
  syncingResults = false;

  readonly sports = [
    { key: SportsEnum.NFL, label: 'NFL' },
    { key: SportsEnum.NCAAF, label: 'NCAAF' },
    { key: SportsEnum.NBA, label: 'NBA' },
    { key: SportsEnum.NCAAB, label: 'NCAAB' },
  ];

  onRefreshOdds(): void {
    if (!this.auth.isAdmin()) return;
    const key = this.sportService.sportKey();
    this.refreshing = true;
    this.oddsService.getFreshOdds(key).subscribe({
      next: () => {
        this.refreshing = false;
      },
      error: () => {
        this.refreshing = false;
      },
    });
  }

  onSyncResults(): void {
    if (!this.auth.isAdmin()) return;
    this.syncingResults = true;
    this.resultsService.syncResults().subscribe({
      next: () => {
        this.syncingResults = false;
      },
      error: () => {
        this.syncingResults = false;
      },
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
