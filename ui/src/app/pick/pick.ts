import { IEventOdds } from './../models/event-odds.model';
import { getTeamAbbr } from './../helpers/team-abbreviation';
import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { normalizeOdds } from './pick.interface';
import { IEvent } from '../models/event.model';
import { IOdds } from '../models/odds.model';
import { SportService } from '../services/sport.service';
import { NflOddsService } from '../services/sport-odds-service';
import { forkJoin, ReplaySubject, Subscription, switchMap } from 'rxjs';
import { SportsEnum } from '../enums/sports.enum';
import { DateService } from '../services/date.service';

@Component({
  selector: 'app-pick',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pick.html',
  styleUrl: './pick.scss'
})
export class Pick implements OnInit {
  sportKey = SportsEnum.NCAAF; // default to NCAAF, can be set from parent component
  loading = true;
  error: string | null = null;
  selected: { eventId: string; team: string; line: number, week: number, season: number } | null = null;
  submitting = false;
  useMocks = false; // toggle this to switch between mocks and real API
  selectedWeek = 1;
  maxWeeks = 18; // default; adjusted per sport
  currentWeekEnd: Date;
  sportsKeySubject$ = new ReplaySubject<string>(1);
  sportsKey: string;
  eventOddsSubscription: Subscription;
  getTeamAbbr = getTeamAbbr;

  private http = inject(HttpClient);
  private router = inject(Router);
  private sportService = inject(SportService);
  private oddsService = inject(NflOddsService);
  private dateService = inject(DateService);
  odds: IOdds[] = [];
  events: IEvent[] = [];
  eventOdds: IEventOdds[] = [];

  constructor() {
    // Initialize with a reasonable default; recomputed on init
    this.currentWeekEnd = this.dateService.getWeekEndDate(this.selectedWeek);
    // Reactively update sportKey and fetch events when the signal changes
    effect(() => {
      const newKey = this.sportService.sportKey();
      if (this.sportsKey !== newKey) {
        this.sportsKey = newKey;
        this.dateService.recomputeSeasonAndWeek();
        this.sportsKeySubject$.next(newKey);
      }
    });
  }


  onWeekChange(week: number) {
    this.selectedWeek = week;
    this.currentWeekEnd = this.dateService.getWeekEndDate(week);
    this.setData();
  }

  ngOnInit() {
    this.loading = true;
    this.sportsKeySubject$.next(this.sportService.sportKey());
    this.dateService.recomputeSeasonAndWeek();
    this.setData();
  }

    setData(): void {
    this.eventOddsSubscription = this.sportsKeySubject$.pipe(
      switchMap((sportsKey) => {
        console.log('Fetching data for sportKey:', sportsKey, 'week:', this.selectedWeek);
        return forkJoin({
          events: this.http.post<IEvent[]>('http://localhost:3000/api/events/', 
            { sportKey: sportsKey }),
          odds: this.oddsService.getCurrentWeekOdds(sportsKey)
        });
      })
    ).subscribe({
      next: ({ events, odds }) => {
        this.eventOdds = this.setThisWeekEvents(normalizeOdds(odds, events));
        this.loading = false;
        console.log('Current week NFL odds:', odds);
        console.log('Event Odds:', this.eventOdds);
      },
      error: (err) => {
        this.loading = false;
        console.error('Error fetching events or odds:', err);
      }
    });
  }

  selectPick(eventId: string, team: string, line: number) {
    this.selected = { eventId, team, line, week: this.selectedWeek, season: new Date().getFullYear() };
    console.log(this.selected)
  }

  submitPick() {
    if (!this.selected) return;
    this.submitting = true;
    const token = localStorage.getItem('jwtToken');
    console.log(token);
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
    this.http.post('http://localhost:3000/api/picks', {
      ...this.selected,
      // Add user info if needed (e.g., from JWT/localStorage)
    }, { headers }).subscribe({
      next: () => {
        this.submitting = false;
        // Redirect to picks summary page
        // this.router.navigate(['/picks-summary']);
        console.log('Pick submitted successfully');
      },
      error: (err) => {
        this.submitting = false;
        if (err.error?.message?.includes('already made a pick')) {
          this.router.navigate(['/picks-summary']);
        } else {
          this.error = err.error?.message || 'Could not submit pick.';
        }
      }
    });
  }

  setThisWeekEvents(eventOdds: IEventOdds[]): IEventOdds[] {
    // For the selected week, show events from Sunday to Saturday
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
