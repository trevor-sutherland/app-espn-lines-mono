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
  readonly creating = signal(false);
  readonly editingUserId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly createSuccess = signal<string | null>(null);
  readonly search = signal('');
  readonly statusFilter = signal<StatusFilter>('all');

  newDisplayName = '';
  newEmail = '';
  newPassword = '';
  newConfirmPassword = '';

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

  get isEditing(): boolean {
    return !!this.editingUserId();
  }

  get passwordsMatch(): boolean {
    return this.newPassword === this.newConfirmPassword;
  }

  get canSubmitUser(): boolean {
    if (!this.newDisplayName.trim() || !this.newEmail.trim() || !this.passwordsMatch) {
      return false;
    }
    if (this.isEditing) {
      return !this.newPassword || this.newPassword.length >= 6;
    }
    return this.newPassword.length >= 6;
  }

  selectUser(user: AdminUser): void {
    this.editingUserId.set(user.id);
    this.newDisplayName = user.displayName || '';
    this.newEmail = user.email;
    this.newPassword = '';
    this.newConfirmPassword = '';
    this.error.set(null);
    this.createSuccess.set(null);
  }

  clearForm(): void {
    this.editingUserId.set(null);
    this.newDisplayName = '';
    this.newEmail = '';
    this.newPassword = '';
    this.newConfirmPassword = '';
    this.error.set(null);
    this.createSuccess.set(null);
  }

  private resetFields(): void {
    this.editingUserId.set(null);
    this.newDisplayName = '';
    this.newEmail = '';
    this.newPassword = '';
    this.newConfirmPassword = '';
  }

  saveUser(e: Event): void {
    e.preventDefault();
    this.error.set(null);
    this.createSuccess.set(null);
    if (!this.canSubmitUser) {
      this.error.set(
        this.isEditing
          ? 'Fill in name and email. If changing the password, use 6+ matching characters.'
          : 'Fill in name, email, and matching passwords (6+ characters).',
      );
      return;
    }
    this.creating.set(true);
    if (this.isEditing) {
      const userId = this.editingUserId() as string;
      this.usersApi
        .updateUser(userId, {
          email: this.newEmail.trim(),
          displayName: this.newDisplayName.trim(),
          ...(this.newPassword ? { password: this.newPassword } : {}),
        })
        .subscribe({
          next: (updated) => {
            this.users.update((list) =>
              list.map((u) => (u.id === userId ? updated : u)),
            );
            this.createSuccess.set(`Saved changes for ${updated.email}.`);
            this.newPassword = '';
            this.newConfirmPassword = '';
            this.creating.set(false);
          },
          error: (err) => {
            this.error.set(err.error?.message || 'Could not save user');
            this.creating.set(false);
          },
        });
      return;
    }
    this.usersApi
      .createUser({
        email: this.newEmail.trim(),
        password: this.newPassword,
        displayName: this.newDisplayName.trim(),
      })
      .subscribe({
        next: (created) => {
          this.users.update((list) => [created, ...list]);
          this.resetFields();
          this.createSuccess.set(`${created.email} can log in now (already approved).`);
          this.creating.set(false);
        },
        error: (err) => {
          this.error.set(err.error?.message || 'Could not create user');
          this.creating.set(false);
        },
      });
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
