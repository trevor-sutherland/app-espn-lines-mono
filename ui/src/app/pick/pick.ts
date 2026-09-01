import { IEventOdds } from './../models/event-odds.model';
import { getTeamAbbr } from './../helpers/team-abbreviation';
import { Component, OnInit, OnDestroy, inject, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import {
  formatPickLabel,
  formatSignedLine,
  formatTotalButton,
  resolvePickMarket,
  type PickMarket,
} from '../helpers/pick-label';
import { IBookmakers } from '../models/bookmaker.model';
import {
  eventHasConference,
  getConferenceLabel,
  getConferencesForSport,
  getTeamConferenceId,
  type ConferenceOption,
} from '../helpers/team-conference';

type SelectedPick = {
  eventId: string;
  team: string;
  market: PickMarket;
  line: number | null;
  week: number;
  season: number;
  loy?: boolean;
};

type LineChangePrompt = {
  eventId: string;
  team: string;
  market: PickMarket;
  submittedLine: number;
  currentLine: number;
};

type MyPickResponse = {
  pick: {
    eventId: string;
    team: string;
    market?: PickMarket;
    line: number | null;
    loy?: boolean;
    season: number;
    week: number;
  } | null;
  loyAvailable?: boolean;
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
  /** True when this user already submitted a pick for this sport this week. */
  weekLocked = false;
  submitting = false;
  selectedWeek = 1;
  currentWeekEnd: Date;
  weekRangeLabel = '';
  picksOpen = false;
  picksOpenLabel = '';
  lineChange: LineChangePrompt | null = null;
  confirmOpen = false;
  loyAvailable = false;
  useLoy = false;
  conferenceFilter = '';
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
        this.conferenceFilter = '';
        this.weekLocked = false;
        this.selected = null;
        this.useLoy = false;
        this.confirmOpen = false;
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
      if (!this.weekLocked && !this.submitting && !this.lineChange && !this.confirmOpen) {
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
              params: {
                season: String(season),
                week: String(week),
                sportKey: sportsKey,
              },
            })
            .pipe(catchError(() => of({ pick: null } as MyPickResponse))),
        });
      }),
    ).subscribe({
      next: ({ events, odds, myPick }) => {
        this.eventOdds = this.setThisWeekEvents(normalizeOdds(odds, events));
        this.loyAvailable = myPick.loyAvailable === true;
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
      this.useLoy = false;
      return;
    }
    this.weekLocked = true;
    this.useLoy = !!pick.loy;
    this.selected = {
      eventId: pick.eventId,
      team: pick.team,
      market: resolvePickMarket(pick.market, pick.team),
      line: pick.line,
      week: pick.week,
      season: pick.season,
      loy: !!pick.loy,
    };
  }

  isSelectedOutcome(
    eventId: string,
    team: string,
    market: PickMarket = 'spreads',
  ): boolean {
    return (
      this.selected?.eventId === eventId &&
      this.selected?.team === team &&
      this.selected?.market === market
    );
  }

  get canPick(): boolean {
    return (
      this.picksOpen &&
      !this.weekLocked &&
      !this.submitting &&
      !this.lineChange &&
      !this.confirmOpen
    );
  }

  get showEventSubmit(): boolean {
    return this.picksOpen && !this.weekLocked && !!this.selected;
  }

  get selectedMatchup(): string | null {
    if (!this.selected) return null;
    const event = this.eventOdds.find((row) => row.id === this.selected?.eventId);
    if (!event) return null;
    return `${event.away_team} at ${event.home_team}`;
  }

  selectPick(
    eventId: string,
    team: string,
    line: number,
    market: PickMarket,
  ) {
    if (!this.canPick) return;
    this.selected = {
      eventId,
      team,
      market,
      line,
      week: Number(this.selectedWeek),
      season: this.dateService.getSeasonYear(),
    };
  }

  isEventSelected(eventId: string): boolean {
    return this.selected?.eventId === eventId;
  }

  togglePick(
    domEvent: Event,
    eventId: string,
    team: string,
    line: number,
    market: PickMarket,
  ) {
    if (!this.canPick) {
      domEvent.preventDefault();
      return;
    }
    if (this.isSelectedOutcome(eventId, team, market)) {
      domEvent.preventDefault();
      this.selected = null;
      (domEvent.target as HTMLInputElement).checked = false;
      return;
    }
    this.selectPick(eventId, team, line, market);
  }

  formatLine(line: number | null | undefined): string {
    return formatSignedLine(line);
  }

  formatPickLabel(
    team: string,
    line: number | null | undefined,
    market?: string | null,
  ): string {
    return formatPickLabel(team, line, market);
  }

  formatTotalButton(
    side: 'Over' | 'Under',
    line: number | null | undefined,
  ): string {
    return formatTotalButton(side, line);
  }

  marketOf(bookmaker: IBookmakers, key: 'spreads' | 'totals') {
    return bookmaker.markets.find((market) => market.key === key) ?? null;
  }

  outcomeNamed(
    bookmaker: IBookmakers,
    marketKey: 'spreads' | 'totals',
    name: string,
  ) {
    const market = this.marketOf(bookmaker, marketKey);
    const key = name.toLowerCase();
    return (
      market?.outcomes.find((outcome) => outcome.name.toLowerCase() === key) ??
      null
    );
  }

  matchupSides(event: IEventOdds): { team: string; total: 'Over' | 'Under' }[] {
    return [
      { team: event.away_team, total: 'Over' },
      { team: event.home_team, total: 'Under' },
    ];
  }

  hasTotals(bookmaker: IBookmakers): boolean {
    const over = this.outcomeNamed(bookmaker, 'totals', 'Over');
    const under = this.outcomeNamed(bookmaker, 'totals', 'Under');
    return (
      over?.point != null &&
      under?.point != null &&
      Number(over.point) !== 0 &&
      Number(under.point) !== 0
    );
  }

  openConfirm(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.selected || !this.picksOpen || this.weekLocked || this.submitting) {
      return;
    }
    this.error = null;
    this.confirmOpen = true;
  }

  closeConfirm(): void {
    if (this.submitting) return;
    this.confirmOpen = false;
  }

  confirmAndSubmit(): void {
    this.submitPick(false);
  }

  submitPick(acceptChangedLine = false) {
    if (!this.selected || this.weekLocked || !this.picksOpen) return;
    this.submitting = true;
    this.error = null;
    const headers = this.auth.authHeaders();
    this.http.post(`${environment.apiBaseUrl}/picks`, {
      ...this.selected,
      sportKey: this.sportService.sportKey(),
      loy: this.loyAvailable && this.useLoy,
      acceptChangedLine,
    }, { headers }).subscribe({
      next: () => {
        this.submitting = false;
        this.weekLocked = true;
        this.confirmOpen = false;
        this.lineChange = null;
        if (this.loyAvailable && this.useLoy) {
          this.loyAvailable = false;
          if (this.selected) {
            this.selected = { ...this.selected, loy: true };
          }
        }
      },
      error: (err) => {
        this.submitting = false;
        const body = err.error;
        if (err.status === 409 && body?.code === 'LOY_ALREADY_USED') {
          this.loyAvailable = false;
          this.useLoy = false;
          this.error = body?.message || 'You already used your LOY this season for this sport.';
          return;
        }
        if (err.status === 409 && body?.code === 'LINE_CHANGED') {
          this.confirmOpen = false;
          this.lineChange = {
            eventId: body.eventId,
            team: body.team,
            market: resolvePickMarket(body.market, body.team),
            submittedLine: body.submittedLine,
            currentLine: body.currentLine,
          };
          this.applyLineToBoard(body.eventId, body.team, body.currentLine);
          return;
        }
        if (err.status === 409) {
          this.confirmOpen = false;
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
      market: this.lineChange.market,
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

  get conferenceOptions(): ConferenceOption[] {
    return getConferencesForSport(this.sportKey);
  }

  get visibleEventOdds(): IEventOdds[] {
    if (!this.conferenceFilter) return this.eventOdds;
    return this.eventOdds.filter((event) =>
      eventHasConference(event, this.sportKey, this.conferenceFilter),
    );
  }

  get conferenceFilterLabel(): string | null {
    return getConferenceLabel(this.conferenceFilter, this.sportKey);
  }

  teamConferenceLabel(teamName: string): string | null {
    return getConferenceLabel(
      getTeamConferenceId(teamName, this.sportKey),
      this.sportKey,
    );
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
