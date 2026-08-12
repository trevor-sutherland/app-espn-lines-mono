import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './reset-password.html',
})
export class ResetPasswordComponent {
  password = '';
  confirmPassword = '';
  loading = false;
  success = false;
  error: string | null = null;
  token: string;
  email: string;

  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private router = inject(Router);

  constructor() {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    this.email = this.route.snapshot.queryParamMap.get('email') || '';
  }

  get passwordsMatch(): boolean {
    return (
      !!this.password &&
      !!this.confirmPassword &&
      this.password === this.confirmPassword
    );
  }

  onSubmit(e: Event) {
    e.preventDefault();
    this.error = null;

    if (!this.token || !this.email) {
      this.error = 'This reset link is invalid or incomplete.';
      return;
    }
    if (!this.passwordsMatch) {
      this.error = 'Passwords do not match.';
      return;
    }

    this.loading = true;
    this.auth.resetPassword(this.email, this.token, this.password).subscribe({
      next: () => {
        this.success = true;
        this.loading = false;
        setTimeout(() => this.router.navigate(['/login']), 2500);
      },
      error: (err) => {
        this.error =
          err?.error?.message ||
          'Reset failed. The link may be invalid or expired.';
        this.loading = false;
      },
    });
  }
}
