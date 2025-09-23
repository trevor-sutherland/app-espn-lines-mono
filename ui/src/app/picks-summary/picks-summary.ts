import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IPickSummary } from './picks-summary.model';
import { DateService } from '../services/date.service';
import { PicksSummaryService } from './picks-summary.service';


@Component({
  selector: 'app-picks-summary',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './picks-summary.html',
  styleUrls: ['./picks-summary.scss']
  
})
export class PicksSummary implements OnInit {
  picks: IPickSummary[] = [];
  filteredPicks: IPickSummary[] = [];
  selectedWeek = 1;
  maxWeeks = 18;

  private dateService = inject(DateService);
  private picksService = inject(PicksSummaryService);
  currentWeek: number;

  ngOnInit() {
    this.currentWeek = this.dateService.currentWeek();
    this.maxWeeks = this.dateService.getMaxWeeks();
    this.selectedWeek = this.currentWeek;
    this.picksService.getPicksSummary().subscribe(data => {
      this.picks = data;
      this.filterByWeek();
    });
  }

  onWeekChange(week: string | number) {
    this.selectedWeek = typeof week === 'string' ? parseInt(week, 10) : week;
    this.filterByWeek();
  }

  filterByWeek() {
    this.filteredPicks = this.picks.filter(pick => pick.week === this.selectedWeek);
  }
}
