import { IEventOdds } from './../models/event-odds.model';
import { getTeamAbbr } from './../helpers/team-abbreviation';
import { Component, OnInit, OnDestroy, inject, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { normalizeOdds } from './pick.interface';
import { IEvent } from '../models/event.model';
import { SportService } from '../services/sport.service';
import { NflOddsService } from '../services/sport-odds-service';
import { forkJoin, of, ReplaySubject, Subscription, switchMap, catchError } from 'rxjs';
import { SportsEnum } from '../enums/sports.enum';
import { DateService } from '../services/date.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

type SelectedPick = {
  eventId: string;
  team: string;
  line: number | null;
  week: number;
  season: number;
};

type MyPickResponse = {
  pick: {
    eventId: string;
    team: string;
    line: number | null;
    season: number;
    week: number;
  } | null;
};

@Component({
  selector: 'app-pick',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pick.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './pick.scss'
})
export class Pick implements OnInit, OnDestroy {
  sportKey = SportsEnum.NCAAF;
  loading = true;
  error: string | null = null;
  selected: SelectedPick | null = null;
  /** True when this user already submitted a pick for the selected week. */
  weekLocked = false;
  submitting = false;
  selectedWeek = 1;
  maxWeeks = 18;
  currentWeekEnd: Date;
  sportsKeySubject$ = new ReplaySubject<string>(1);
  sportsKey: string;
  eventOddsSubscription: Subscription | null = null;
  getTeamAbbr = getTeamAbbr;

  private http = inject(HttpClient);
  private sportService = inject(SportService);
  private oddsService = inject(NflOddsService);
  private dateService = inject(DateService);
  private auth = inject(AuthService);
  eventOdds: IEventOdds[] = [];

  constructor() {
    this.currentWeekEnd = this.dateService.getWeekEndDate(this.selectedWeek);
    effect(() => {
      const newKey = this.sportService.sportKey();
      if (this.sportsKey !== newKey) {
        this.sportsKey = newKey;
        this.sportKey = newKey as SportsEnum;
        this.dateService.recomputeSeasonAndWeek();
        this.selectedWeek = this.dateService.getSelectedWeek();
        this.maxWeeks = this.dateService.getMaxWeeks();
        this.currentWeekEnd = this.dateService.getWeekEndDate(this.selectedWeek);
        this.sportsKeySubject$.next(newKey);
      }
    });
  }

  onWeekChange(week: number | string) {
    this.selectedWeek = Number(week);
    this.currentWeekEnd = this.dateService.getWeekEndDate(this.selectedWeek);
    this.selected = null;
    this.weekLocked = false;
    this.setData();
  }

  ngOnInit() {
    this.loading = true;
    this.dateService.recomputeSeasonAndWeek();
    this.selectedWeek = this.dateService.getSelectedWeek();
    this.maxWeeks = this.dateService.getMaxWeeks();
    this.currentWeekEnd = this.dateService.getWeekEndDate(this.selectedWeek);
    this.sportsKeySubject$.next(this.sportService.sportKey());
    this.setData();
  }

  ngOnDestroy(): void {
    this.eventOddsSubscription?.unsubscribe();
  }

  setData(): void {
    this.eventOddsSubscription?.unsubscribe();
    this.loading = true;
    this.error = null;

    this.eventOddsSubscription = this.sportsKeySubject$.pipe(
      switchMap((sportsKey) => {
        const season = this.dateService.getSeasonYear();
        const week = Number(this.selectedWeek);
        return forkJoin({
          events: this.http.post<IEvent[]>(`${environment.apiBaseUrl}/events/`, {
            sportKey: sportsKey,
          }),
          odds: this.oddsService.getCurrentWeekOdds(sportsKey),
          myPick: this.http
            .get<MyPickResponse>(`${environment.apiBaseUrl}/picks/mine`, {
              headers: this.auth.authHeaders(),
              params: { season: String(season), week: String(week) },
            })
            .pipe(catchError(() => of({ pick: null } as MyPickResponse))),
        });
      }),
    ).subscribe({
      next: ({ events, odds, myPick }) => {
        this.eventOdds = this.setThisWeekEvents(normalizeOdds(odds, events));
        this.applyExistingPick(myPick.pick);
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Could not load games.';
        console.error('Error fetching events or odds:', err);
      },
    });
  }

  private applyExistingPick(
    pick: MyPickResponse['pick'],
  ): void {
    if (!pick) {
      this.weekLocked = false;
      this.selected = null;
      return;
    }
    this.weekLocked = true;
    this.selected = {
      eventId: pick.eventId,
      team: pick.team,
      line: pick.line,
      week: pick.week,
      season: pick.season,
    };
  }

  selectPick(eventId: string, team: string, line: number) {
    if (this.weekLocked || this.submitting) return;
    this.selected = {
      eventId,
      team,
      line,
      week: Number(this.selectedWeek),
      season: this.dateService.getSeasonYear(),
    };
  }

  submitPick() {
    if (!this.selected || this.weekLocked) return;
    this.submitting = true;
    this.error = null;
    const headers = this.auth.authHeaders();
    this.http.post(`${environment.apiBaseUrl}/picks`, {
      ...this.selected,
    }, { headers }).subscribe({
      next: () => {
        this.submitting = false;
        this.weekLocked = true;
      },
      error: (err) => {
        this.submitting = false;
        if (err.status === 409) {
          // Already locked on server — reload locked state instead of navigating away
          this.setData();
          return;
        }
        this.error = err.error?.message || 'Could not submit pick.';
      },
    });
  }

  setThisWeekEvents(eventOdds: IEventOdds[]): IEventOdds[] {
    const weekStart = new Date(this.currentWeekEnd);
    weekStart.setDate(this.currentWeekEnd.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    return eventOdds.filter(eo => {
      const eventDate = new Date(eo.commence_time);
      return eventDate >= weekStart && eventDate <= this.currentWeekEnd;
    });
  }

  getSportAbbr(): string {
    const sportKey = this.sportService.sportKey();
    const parts = sportKey.split('_');
    return parts.length > 1 ? parts[1] : sportKey;
  }
}
