import { inject, Injectable, effect, WritableSignal, signal } from '@angular/core';
import { SportService } from './sport.service';
import {
  getCurrentSeasonAndWeek,
  getSeasonYear as seasonYearFromClock,
  getWeekBounds,
  maxWeeksForSport,
} from '../helpers/season-week';

@Injectable({
  providedIn: 'root',
})
export class DateService {
  private maxWeeks = 18;
  private currentWeekEnd!: Date;
  private selectedWeek = 1;
  private sportService = inject(SportService);
  currentWeek: WritableSignal<number> = signal(1);

  constructor() {
    this.recomputeSeasonAndWeek();

    effect(() => {
      this.sportService.sportKey();
      this.recomputeSeasonAndWeek();
    });
  }

  private sportKey(): string {
    return this.sportService.sportKey();
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
    return this.sportKey();
  }

  setSelectedWeek(week: number): void {
    this.selectedWeek = week;
    this.currentWeekEnd = this.getWeekEndDate(week);
  }

  getWeekStartDate(week: number, seasonYear = this.getSeasonYear()): Date {
    return getWeekBounds(seasonYear, week, this.sportKey()).start;
  }

  getWeekEndDate(week: number, seasonYear = this.getSeasonYear()): Date {
    return getWeekBounds(seasonYear, week, this.sportKey()).end;
  }

  getWeekRangeLabel(week: number, seasonYear = this.getSeasonYear()): string {
    return getWeekBounds(seasonYear, week, this.sportKey()).rangeLabel;
  }

  getPicksOpenAt(week: number, seasonYear = this.getSeasonYear()): Date {
    return getWeekBounds(seasonYear, week, this.sportKey()).picksOpenAt;
  }

  arePicksOpen(week: number, seasonYear = this.getSeasonYear(), now = new Date()): boolean {
    return now.getTime() >= this.getPicksOpenAt(week, seasonYear).getTime();
  }

  recomputeSeasonAndWeek(today: Date = new Date()): void {
    const sportKey = this.sportKey();
    this.maxWeeks = maxWeeksForSport(sportKey);
    const current = getCurrentSeasonAndWeek(today, this.maxWeeks, sportKey);
    this.selectedWeek = current.week;
    this.currentWeek.set(current.week);
    this.currentWeekEnd = current.end;
  }
}
