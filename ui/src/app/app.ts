import { Component, inject, signal } from '@angular/core';
import { NflOddsService } from './services/sport-odds-service';
import { RouterOutlet } from "@angular/router";
// import { oddsMock } from './mocks/oddsNfl.mock';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SportService } from './services/sport.service';
import {SportsEnum} from "./enums/sports.enum";

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  standalone: true,
  imports: [RouterOutlet, FormsModule, CommonModule],

})
export class App {
  protected readonly title = signal('app-espn-lines');
  private oddsService = inject(NflOddsService);
  sportService = inject(SportService);
  sportKey = this.sportService.sportKey;
  refreshing = false;
  sports = [
    { key: SportsEnum.NFL, label: 'NFL' },
    { key: SportsEnum.NCAAF, label: 'NCAAF' },
    { key: SportsEnum.NBA, label: 'NBA' },
    { key: SportsEnum.NCAAB, label: 'NCAAB' },
    // Add more sports as needed
  ];

  setSportKey(key: string) {
    this.sportService.setSportKey(key);
  }

  onRefreshOdds() {
    const key = this.sportService.sportKey();
    this.refreshing = true;
    this.oddsService.getFreshOdds(key).subscribe({
      next: () => {
        this.refreshing = false;
      },
      error: () => {
        this.refreshing = false;
      }
    });
  }
}
