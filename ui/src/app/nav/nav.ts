import {
  Component,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
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
  private readonly router = inject(Router);

  refreshing = false;
  syncingResults = false;
  navCollapsed = true;

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.navCollapsed = true;
      });
  }

  toggleNav(): void {
    this.navCollapsed = !this.navCollapsed;
  }

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
