import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './forgot-password.html',
})
export class ForgotPasswordComponent {
  email = '';
  submitted = false;
  loading = false;
  error: string | null = null;

  private auth = inject(AuthService);

  onSubmit(e: Event) {
    e.preventDefault();
    this.loading = true;
    this.error = null;
    this.auth.requestPasswordReset(this.email).subscribe({
      next: () => {
        this.submitted = true;
        this.loading = false;
      },
      error: () => {
        // Still show success-style message to avoid email enumeration
        this.submitted = true;
        this.loading = false;
      },
    });
  }
}
