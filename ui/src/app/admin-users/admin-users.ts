import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminUser, UsersAdminService } from '../services/users-admin.service';
import { AuthService } from '../services/auth.service';

export type StatusFilter = 'all' | 'active' | 'inactive' | 'pending';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class AdminUsersComponent implements OnInit {
  readonly users = signal<AdminUser[]>([]);
  readonly loading = signal(true);
  readonly busyUserId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly search = signal('');
  readonly statusFilter = signal<StatusFilter>('all');

  readonly filteredUsers = computed(() => {
    const q = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.users().filter((user) => {
      if (status === 'pending' && user.approved) return false;
      if (status === 'active' && !(user.approved && user.active !== false)) {
        return false;
      }
      if (status === 'inactive' && user.active !== false) return false;
      if (!q) return true;
      return (
        user.email.toLowerCase().includes(q) ||
        (user.displayName || '').toLowerCase().includes(q)
      );
    });
  });

  private readonly usersApi = inject(UsersAdminService);
  private readonly auth = inject(AuthService);

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.error.set(null);
    this.usersApi.listUsers().subscribe({
      next: (res) => {
        this.users.set(res.users);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Failed to load users');
        this.loading.set(false);
      },
    });
  }

  onSearchChange(value: string): void {
    this.search.set(value);
  }

  onStatusFilterChange(value: string): void {
    this.statusFilter.set(value as StatusFilter);
  }

  isSelf(user: AdminUser): boolean {
    return user.id === this.auth.session()?.userId;
  }

  approve(user: AdminUser): void {
    this.run(user.id, this.usersApi.approve(user.id));
  }

  deny(user: AdminUser): void {
    if (this.isSelf(user)) return;
    this.run(user.id, this.usersApi.deny(user.id));
  }

  toggleAdmin(user: AdminUser, checked: boolean): void {
    if (this.isSelf(user) && !checked) return;
    const role = checked ? 'admin' : 'user';
    this.run(user.id, this.usersApi.setRole(user.id, role));
  }

  deactivate(user: AdminUser): void {
    if (this.isSelf(user)) return;
    if (!confirm(`Deactivate ${user.email}? They will not be able to log in.`)) {
      return;
    }
    this.run(user.id, this.usersApi.setActive(user.id, false));
  }

  reactivate(user: AdminUser): void {
    this.run(user.id, this.usersApi.setActive(user.id, true));
  }

  private run(userId: string, req: import('rxjs').Observable<AdminUser>): void {
    this.busyUserId.set(userId);
    this.error.set(null);
    req.subscribe({
      next: (updated) => {
        this.users.update((list) =>
          list.map((u) => (u.id === userId ? updated : u)),
        );
        this.busyUserId.set(null);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Update failed');
        this.busyUserId.set(null);
      },
    });
  }
}
