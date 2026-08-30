import { inject, Injectable, effect, WritableSignal, signal } from '@angular/core';
import { SportService } from './sport.service';
import {
  getCurrentSeasonAndWeek,
  getSeasonYear as seasonYearFromClock,
  getWeekBounds,
} from '../helpers/season-week';

@Injectable({
  providedIn: 'root',
})
export class DateService {
  private maxWeeks = 18;
  private currentWeekEnd!: Date;
  private selectedWeek = 1;
  private sportService = inject(SportService);
  private sportKey = this.sportService.sportKey();
  currentWeek: WritableSignal<number> = signal(1);

  constructor() {
    this.recomputeSeasonAndWeek();

    effect(() => {
      const newKey = this.sportService.sportKey();
      if (this.sportKey !== newKey) {
        this.sportKey = newKey;
        this.recomputeSeasonAndWeek();
      }
    });
  }

  getSelectedWeek(): number {
    return this.selectedWeek;
  }

  getCurrentWeekEnd(): Date {
    return this.currentWeekEnd;
  }

  getMaxWeeks(): number {
    return this.maxWeeks;
  }

  /** Season year for pick’em (July+ → current calendar year; earlier → previous). */
  getSeasonYear(today: Date = new Date()): number {
    return seasonYearFromClock(today);
  }

  getSportKey(): string {
    return this.sportKey;
  }

  setSelectedWeek(week: number): void {
    this.selectedWeek = week;
    this.currentWeekEnd = this.getWeekEndDate(week);
  }

  getWeekStartDate(week: number, seasonYear = this.getSeasonYear()): Date {
    return getWeekBounds(seasonYear, week).start;
  }

  getWeekEndDate(week: number, seasonYear = this.getSeasonYear()): Date {
    return getWeekBounds(seasonYear, week).end;
  }

  getWeekRangeLabel(week: number, seasonYear = this.getSeasonYear()): string {
    return getWeekBounds(seasonYear, week).rangeLabel;
  }

  getPicksOpenAt(week: number, seasonYear = this.getSeasonYear()): Date {
    return getWeekBounds(seasonYear, week).picksOpenAt;
  }

  arePicksOpen(week: number, seasonYear = this.getSeasonYear(), now = new Date()): boolean {
    return now.getTime() >= this.getPicksOpenAt(week, seasonYear).getTime();
  }

  recomputeSeasonAndWeek(today: Date = new Date()): void {
    this.maxWeeks = this.maxWeeksForSport(this.sportKey);
    const current = getCurrentSeasonAndWeek(today, this.maxWeeks);
    this.selectedWeek = current.week;
    this.currentWeek.set(current.week);
    this.currentWeekEnd = current.end;
  }

  private maxWeeksForSport(sportKey: string): number {
    const sport = sportKey.toLowerCase();
    if (sport.includes('ncaaf')) {
      return 14;
    }
    if (sport.includes('nfl')) {
      return 18;
    }
    return 18;
  }
}
