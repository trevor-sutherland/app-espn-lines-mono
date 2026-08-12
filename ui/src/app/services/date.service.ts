import { inject, Injectable, effect, WritableSignal, signal } from '@angular/core';
import { SportService } from './sport.service';

@Injectable({
  providedIn: 'root',
})
export class DateService {
  private seasonStartWeekStart!: Date; // Sunday starting Week 1 for current sport/season
  private maxWeeks = 18;
  private currentWeekEnd!: Date;
  private selectedWeek = 1;
  private sportService = inject(SportService);
  private sportKey = this.sportService.sportKey();
  currentWeek: WritableSignal<number> = signal(1);

  constructor() {
    // Initialize derived state based on the initial sport key
    this.recomputeSeasonAndWeek();

    // React to sport key signal changes and recompute
    effect(() => {
      const newKey = this.sportService.sportKey();
      if (this.sportKey !== newKey) {
        this.sportKey = newKey;
        this.recomputeSeasonAndWeek();
      }
    });
  }

  // Expose read APIs
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
    const month = today.getMonth();
    return month >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  }

  getSportKey(): string {
    return this.sportKey;
  }

  // Update selected week and recompute week end
  setSelectedWeek(week: number): void {
    this.selectedWeek = week;
    this.currentWeekEnd = this.getWeekEndDate(week);
  }

  getWeekEndDate(week: number): Date {
    // Compute week end (Saturday 23:59:59) from the computed Week 1 Sunday
    const start =
      this.seasonStartWeekStart ??
      this.getSeasonConfig(this.sportKey).week1Start;
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + (week - 1) * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return weekEnd;
  }

  // --- Week/Season helpers ---
  recomputeSeasonAndWeek(today: Date = new Date()): void {
    const { week1Start, maxWeeks } = this.getSeasonConfig(this.sportKey, today);
    this.seasonStartWeekStart = week1Start;
    this.maxWeeks = maxWeeks;
    this.selectedWeek = this.computeCurrentWeek(week1Start, maxWeeks, today);
    this.currentWeekEnd = this.getWeekEndDate(this.selectedWeek);
  }

  private getSeasonConfig(
    sportKey: string,
    today: Date = new Date()
  ): { week1Start: Date; maxWeeks: number } {
    const sport = sportKey.toLowerCase();
    // Determine the "season year". For NFL/CFB, the season starts in late summer/early fall.
    // If date is before July, treat it as belonging to the previous season.
    const month = today.getMonth(); // 0-11
    const seasonYear =
      month >= 6 ? today.getFullYear() : today.getFullYear() - 1; // July or later -> current year

    // Labor Day (first Monday of September) for the seasonYear
    const laborDay = this.firstMondayOfSeptember(seasonYear);
    // NFL kickoff is the Thursday after Labor Day. CFB also centers around Labor Day weekend; good proxy.
    const kickoffThursday = new Date(laborDay);
    kickoffThursday.setDate(laborDay.getDate() + 3);
    // Week 1 starts on the Sunday prior to kickoff Thursday (so Thursday falls within Sun-Sat window)
    const week1Start = this.previousSunday(kickoffThursday);

    // Max weeks by sport (regular season). Adjust as needed.
    const maxWeeks = sport.includes('nfl')
      ? 18
      : sport.includes('ncaaf')
      ? 14
      : 18;
    return { week1Start, maxWeeks };
  }

  private computeCurrentWeek(
    week1Start: Date,
    maxWeeks: number,
    today: Date
  ): number {
    const start = new Date(week1Start);
    start.setHours(0, 0, 0, 0);
    const now = new Date(today);
    now.setHours(0, 0, 0, 0);
    if (now <= start) return 1;
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysDiff = Math.floor((now.getTime() - start.getTime()) / msPerDay);
    const week = Math.floor(daysDiff / 7) + 1;
    this.currentWeek.set(this.clamp(week, 1, maxWeeks));
    return this.clamp(week, 1, maxWeeks);
  }

  private firstMondayOfSeptember(year: number): Date {
    const d = new Date(year, 8, 1);
    while (d.getDay() !== 1) {
      d.setDate(d.getDate() + 1);
    }
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private previousSunday(date: Date): Date {
    const d = new Date(date);
    const diff = d.getDay(); // 0=Sun
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
  }
}
