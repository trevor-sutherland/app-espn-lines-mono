import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PotAdminService, PotMember, SeasonPotView } from '../services/pot-admin.service';
import { DateService } from '../services/date.service';

@Component({
  selector: 'app-admin-pot',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './admin-pot.html',
  styleUrl: './admin-pot.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class AdminPotComponent implements OnInit {
  readonly seasons = signal<string[]>([]);
  readonly season = signal('');
  readonly pot = signal<SeasonPotView | null>(null);
  readonly potAmountDraft = signal(0);
  readonly adminFeePercentDraft = signal(0);
  readonly loading = signal(true);
  readonly savingSettings = signal(false);
  readonly busyUserId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly search = signal('');
  readonly paidFilter = signal<'all' | 'paid' | 'unpaid'>('all');

  readonly filteredMembers = computed(() => {
    const members = this.pot()?.members ?? [];
    const q = this.search().trim().toLowerCase();
    const filter = this.paidFilter();
    return members.filter((m) => {
      if (filter === 'paid' && !m.paid) return false;
      if (filter === 'unpaid' && m.paid) return false;
      if (!q) return true;
      return (
        m.email.toLowerCase().includes(q) ||
        (m.displayName || '').toLowerCase().includes(q)
      );
    });
  });

  private readonly potApi = inject(PotAdminService);
  private readonly dateService = inject(DateService);

  ngOnInit(): void {
    const current = this.dateService.getSeasonYear();
    const years = new Set<number>([current, current - 1, current - 2, 2025, 2024]);
    const seasons = [...years]
      .filter((y) => y >= 2024)
      .sort((a, b) => b - a)
      .map(String);
    this.seasons.set(seasons);
    this.season.set(seasons.includes(String(current)) ? String(current) : seasons[0]);
    this.load();
  }

  onSeasonChange(value: string): void {
    this.season.set(value);
    this.load();
  }

  onSearchChange(value: string): void {
    this.search.set(value);
  }

  onPaidFilterChange(value: string): void {
    this.paidFilter.set(value as 'all' | 'paid' | 'unpaid');
  }

  onPotAmountDraftChange(value: string | number): void {
    this.potAmountDraft.set(Number(value) || 0);
  }

  onAdminFeePercentDraftChange(value: string | number): void {
    this.adminFeePercentDraft.set(Number(value) || 0);
  }

  saveSettings(): void {
    const seasonNum = Number(this.season());
    this.savingSettings.set(true);
    this.error.set(null);
    this.potApi
      .setSettings(seasonNum, this.potAmountDraft(), this.adminFeePercentDraft())
      .subscribe({
        next: (view) => {
          this.applyView(view);
          this.savingSettings.set(false);
        },
        error: (err) => {
          this.error.set(err.error?.message || 'Failed to save pot settings');
          this.savingSettings.set(false);
        },
      });
  }

  togglePaid(member: PotMember, paid: boolean): void {
    const seasonNum = Number(this.season());
    this.busyUserId.set(member.userId);
    this.error.set(null);
    this.potApi.setPaid(seasonNum, member.userId, paid).subscribe({
      next: (view) => {
        this.applyView(view);
        this.busyUserId.set(null);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to update payment');
        this.busyUserId.set(null);
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.potApi.get(Number(this.season())).subscribe({
      next: (view) => {
        this.applyView(view);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to load pot');
        this.loading.set(false);
      },
    });
  }

  private applyView(view: SeasonPotView): void {
    this.pot.set(view);
    this.potAmountDraft.set(view.potAmount);
    this.adminFeePercentDraft.set(view.adminFeePercent);
  }
}
