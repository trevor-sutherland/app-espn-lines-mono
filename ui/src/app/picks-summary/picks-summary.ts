import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface PickSummary {
  _id: string;
  userId: { displayName: string };
  team: string;
  line: number;
  season: number;
  week: number;
  status: string;
  createdAt: Date;
}

@Component({
  selector: 'app-picks-summary',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './picks-summary.html',
  styleUrls: ['./picks-summary.scss']
  
})
export class PicksSummary implements OnInit {
  picks: PickSummary[] = [];
  filteredPicks: PickSummary[] = [];
  selectedWeek = 1;
  maxWeeks = 18;

  private http = inject(HttpClient);

  ngOnInit() {
    this.http.get<PickSummary[]>('http://localhost:3000/api/picks/all').subscribe(data => {
      this.picks = data;
      this.filterByWeek();
    });
  }

  onWeekChange(week: string | number) {
    this.selectedWeek = typeof week === 'string' ? parseInt(week, 10) : week ;
    this.filterByWeek();
  }

  filterByWeek() {
    console.log(this.picks);
    console.log(this.selectedWeek);
    this.filteredPicks = this.picks.filter(pick => pick.week === this.selectedWeek);
    console.log(this.filteredPicks);
  }
}
