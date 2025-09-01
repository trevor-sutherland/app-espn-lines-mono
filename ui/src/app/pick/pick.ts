import { getTeamAbbr } from './../helpers/team-abbreviation';
import { Component, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { normalizeMocks, Event } from './pick.interface';
import { SportService } from '../sport.service';

@Component({
  selector: 'app-pick',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pick.html',
  styleUrl: './pick.scss'
})
export class Pick implements OnInit {
  sportKey = 'americanfootball_nfl'; // default to NFL, can be set from parent component
  events: Event[] = [];
  loading = false;
  error: string | null = null;
  selected: { eventId: string; team: string; line: number, week: number, season: number } | null = null;
  submitting = false;
  useMocks = true; // toggle this to switch between mocks and real API
  selectedWeek = 1;
  maxWeeks = 18; // NFL regular season
  currentWeekEnd: Date;
  getTeamAbbr = getTeamAbbr;

  private http = inject(HttpClient);
  private router = inject(Router);
  private sportService = inject(SportService);

  constructor() {
    this.currentWeekEnd = this.getWeekEndDate(this.selectedWeek);
    // Reactively update sportKey and fetch events when the signal changes
    effect(() => {
      const newKey = this.sportService.sportKey();
      if (this.sportKey !== newKey) {
        this.sportKey = newKey;
        this.fetchEvents();
      }
    });
  }

  getWeekEndDate(week: number): Date {
    // NFL week 1 starts with the first full week of September (customize as needed)
    // For this example, let's use Sept 1, 2025 as the start of week 1
    const seasonStart = new Date(2025, 8, 1); // September is month 8 (0-based)
    const weekEnd = new Date(seasonStart);
    weekEnd.setDate(seasonStart.getDate() + (week - 1) * 7 + 5); // Saturday of the week
    weekEnd.setHours(23, 59, 59, 999);
    return weekEnd;
  }

  onWeekChange(week: number) {
    this.selectedWeek = week;
    this.currentWeekEnd = this.getWeekEndDate(week);
    this.fetchEvents();
  }

  ngOnInit() {
    this.sportKey = this.sportService.sportKey();
    this.fetchEvents();
  }

  fetchEvents() {
    this.loading = true;
    if (this.useMocks) {
      this.events = this.setThisWeekEvents(normalizeMocks(this.sportKey));
      this.loading = false;
    } else {
      this.http.post<Event[]>('http://localhost:3000/api/events/', 
        { sportKey: this.sportKey }).subscribe({
        next: (data) => {
          this.events = this.setThisWeekEvents(data);
          this.loading = false;
        },
        error: () => {
          this.error = 'Could not load events.';
          this.loading = false;
        }
      });
    }
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

  setThisWeekEvents(events: Event[]): Event[] {
    // For the selected week, show events from Sunday to Saturday
    const weekStart = new Date(this.currentWeekEnd);
    weekStart.setDate(this.currentWeekEnd.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    return events.filter(event => {
      const eventDate = new Date(event.commence_time);
      return eventDate >= weekStart && eventDate <= this.currentWeekEnd;
    });
  }

  getSportAbbr(): string {
    const sportKey = this.sportService.sportKey();
    const parts = sportKey.split('_');
    return parts.length > 1 ? parts[1] : sportKey;
  }

}
