import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './account.html',
  styleUrl: './account.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class AccountComponent implements OnInit {
  currentEmail = '';
  pendingEmail: string | null = null;
  email = '';
  displayName = '';
  nameLoading = false;
  emailLoading = false;
  nameError: string | null = null;
  nameSuccess: string | null = null;
  emailError: string | null = null;
  emailSuccess: string | null = null;

  private readonly auth = inject(AuthService);

  ngOnInit(): void {
    this.auth.getProfile().subscribe({
      next: (profile) => {
        this.currentEmail = profile.email;
        this.pendingEmail = profile.pendingEmail;
        this.email = profile.pendingEmail || profile.email;
        this.displayName = profile.displayName || '';
      },
      error: () => {
        this.currentEmail = this.auth.session()?.email ?? '';
        this.email = this.currentEmail;
      },
    });
  }

  onSaveDisplayName(e: Event): void {
    e.preventDefault();
    this.nameLoading = true;
    this.nameError = null;
    this.nameSuccess = null;

    this.auth.updateDisplayName(this.displayName).subscribe({
      next: (res) => {
        this.displayName = res.displayName;
        this.nameSuccess = 'Display name updated.';
        this.nameLoading = false;
      },
      error: (err) => {
        this.nameError =
          err?.error?.message ||
          (Array.isArray(err?.error?.message)
            ? err.error.message.join(', ')
            : null) ||
          'Could not update display name.';
        this.nameLoading = false;
      },
    });
  }

  onRequestEmailChange(e: Event): void {
    e.preventDefault();
    this.emailLoading = true;
    this.emailError = null;
    this.emailSuccess = null;

    this.auth.requestEmailChange(this.email).subscribe({
      next: (res) => {
        this.currentEmail = res.currentEmail;
        this.pendingEmail = res.pendingEmail;
        this.emailSuccess = `Confirmation sent to ${res.pendingEmail}. Your login email stays ${res.currentEmail} until you click the link.`;
        this.emailLoading = false;
      },
      error: (err) => {
        this.emailError =
          err?.error?.message ||
          (Array.isArray(err?.error?.message)
            ? err.error.message.join(', ')
            : null) ||
          'Could not start email change.';
        this.emailLoading = false;
      },
    });
  }
}
