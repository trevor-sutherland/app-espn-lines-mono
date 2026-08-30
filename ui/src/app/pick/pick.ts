import { IEventOdds } from './../models/event-odds.model';
import { getTeamAbbr } from './../helpers/team-abbreviation';
import { Component, OnInit, OnDestroy, inject, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { normalizeOdds } from './pick.interface';
import { IEvent } from '../models/event.model';
import { SportService } from '../services/sport.service';
import { NflOddsService } from '../services/sport-odds-service';
import { forkJoin, of, ReplaySubject, Subscription, switchMap, catchError } from 'rxjs';
import { SportsEnum } from '../enums/sports.enum';
import { DateService } from '../services/date.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { formatPicksOpenAt } from '../helpers/season-week';

type SelectedPick = {
  eventId: string;
  team: string;
  line: number | null;
  week: number;
  season: number;
};

type LineChangePrompt = {
  eventId: string;
  team: string;
  submittedLine: number;
  currentLine: number;
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
  imports: [CommonModule],
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
  currentWeekEnd: Date;
  weekRangeLabel = '';
  picksOpen = false;
  picksOpenLabel = '';
  lineChange: LineChangePrompt | null = null;
  sportsKeySubject$ = new ReplaySubject<string>(1);
  sportsKey: string;
  eventOddsSubscription: Subscription | null = null;
  private oddsRefreshTimer: ReturnType<typeof setInterval> | null = null;
  getTeamAbbr = getTeamAbbr;

  private http = inject(HttpClient);
  private sportService = inject(SportService);
  private oddsService = inject(NflOddsService);
  private dateService = inject(DateService);
  private auth = inject(AuthService);
  eventOdds: IEventOdds[] = [];

  constructor() {
    this.applyCurrentWeek();
    effect(() => {
      const newKey = this.sportService.sportKey();
      if (this.sportsKey !== newKey) {
        this.sportsKey = newKey;
        this.sportKey = newKey as SportsEnum;
        this.dateService.recomputeSeasonAndWeek();
        this.applyCurrentWeek();
        this.sportsKeySubject$.next(newKey);
      }
    });
  }

  ngOnInit() {
    this.loading = true;
    this.dateService.recomputeSeasonAndWeek();
    this.applyCurrentWeek();
    this.sportsKeySubject$.next(this.sportService.sportKey());
    this.setData();
    this.oddsRefreshTimer = setInterval(() => {
      if (!this.weekLocked && !this.submitting && !this.lineChange) {
        this.setData();
      }
    }, 60 * 60 * 1000);
  }

  private applyCurrentWeek(): void {
    this.selectedWeek = this.dateService.getSelectedWeek();
    this.currentWeekEnd = this.dateService.getWeekEndDate(this.selectedWeek);
    this.weekRangeLabel = this.dateService.getWeekRangeLabel(this.selectedWeek);
    const opensAt = this.dateService.getPicksOpenAt(this.selectedWeek);
    this.picksOpen = this.dateService.arePicksOpen(this.selectedWeek);
    this.picksOpenLabel = formatPicksOpenAt(opensAt);
  }

  ngOnDestroy(): void {
    this.eventOddsSubscription?.unsubscribe();
    if (this.oddsRefreshTimer) {
      clearInterval(this.oddsRefreshTimer);
      this.oddsRefreshTimer = null;
    }
  }

  setData(): void {
    this.eventOddsSubscription?.unsubscribe();
    const showSpinner = this.eventOdds.length === 0;
    if (showSpinner) {
      this.loading = true;
    }
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

  isSelectedOutcome(eventId: string, team: string): boolean {
    return this.selected?.eventId === eventId && this.selected?.team === team;
  }

  get canPick(): boolean {
    return this.picksOpen && !this.weekLocked && !this.submitting && !this.lineChange;
  }

  selectPick(eventId: string, team: string, line: number) {
    if (!this.canPick) return;
    this.selected = {
      eventId,
      team,
      line,
      week: Number(this.selectedWeek),
      season: this.dateService.getSeasonYear(),
    };
  }

  isEventSelected(eventId: string): boolean {
    return this.selected?.eventId === eventId;
  }

  togglePick(domEvent: Event, eventId: string, team: string, line: number) {
    if (!this.canPick) {
      domEvent.preventDefault();
      return;
    }
    if (this.isSelectedOutcome(eventId, team)) {
      domEvent.preventDefault();
      this.selected = null;
      (domEvent.target as HTMLInputElement).checked = false;
      return;
    }
    this.selectPick(eventId, team, line);
  }

  formatLine(line: number | null | undefined): string {
    if (line == null || Number.isNaN(Number(line))) {
      return '—';
    }
    const n = Number(line);
    return `${n > 0 ? '+' : ''}${n}`;
  }

  onSubmitForm(event: Event): void {
    event.preventDefault();
    this.submitPick(false);
  }

  submitPick(acceptChangedLine = false) {
    if (!this.selected || this.weekLocked || !this.picksOpen) return;
    this.submitting = true;
    this.error = null;
    const headers = this.auth.authHeaders();
    this.http.post(`${environment.apiBaseUrl}/picks`, {
      ...this.selected,
      acceptChangedLine,
    }, { headers }).subscribe({
      next: () => {
        this.submitting = false;
        this.weekLocked = true;
        this.lineChange = null;
      },
      error: (err) => {
        this.submitting = false;
        const body = err.error;
        if (err.status === 409 && body?.code === 'LINE_CHANGED') {
          this.lineChange = {
            eventId: body.eventId,
            team: body.team,
            submittedLine: body.submittedLine,
            currentLine: body.currentLine,
          };
          this.applyLineToBoard(body.eventId, body.team, body.currentLine);
          return;
        }
        if (err.status === 409) {
          this.setData();
          return;
        }
        this.error = body?.message || 'Could not submit pick.';
      },
    });
  }

  approveNewLine(): void {
    if (!this.lineChange || !this.selected) return;
    this.selected = {
      ...this.selected,
      eventId: this.lineChange.eventId,
      team: this.lineChange.team,
      line: this.lineChange.currentLine,
    };
    this.submitPick(true);
  }

  cancelLineChange(): void {
    this.lineChange = null;
  }

  private applyLineToBoard(eventId: string, team: string, line: number): void {
    const teamKey = team.toLowerCase();
    this.eventOdds = this.eventOdds.map((event) => {
      if (event.id !== eventId) return event;
      return {
        ...event,
        bookmakers: event.bookmakers.map((bookmaker) => ({
          ...bookmaker,
          markets: bookmaker.markets.map((market) => ({
            ...market,
            outcomes: market.outcomes.map((outcome) =>
              outcome.name.toLowerCase() === teamKey
                ? { ...outcome, point: line }
                : outcome,
            ),
          })),
        })),
      };
    });
  }

  setThisWeekEvents(eventOdds: IEventOdds[]): IEventOdds[] {
    const weekStart = this.dateService.getWeekStartDate(this.selectedWeek);
    return eventOdds.filter((eo) => {
      const eventDate = new Date(eo.commence_time);
      return eventDate >= weekStart && eventDate <= this.currentWeekEnd;
    });
  }

  getSportAbbr(): string {
    const sportKey = this.sportService.sportKey();
    const parts = sportKey.split('_');
    return parts.length > 1 ? parts[1] : sportKey;
  }

  teamLogoUrl(teamName: string): string {
    const abbr = getTeamAbbr(teamName, this.sportKey);
    if (!abbr || abbr === 'default') {
      return '/assets/default.png';
    }
    return `/assets/${this.getSportAbbr()}/${abbr}.png`;
  }

  onLogoError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.src.endsWith('/assets/default.png')) {
      img.src = '/assets/default.png';
    }
  }
}
