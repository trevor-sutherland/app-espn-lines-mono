import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './signup.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './signup.scss',
})
export class Signup {
  email = '';
  password = '';
  confirmPassword = '';
  displayName = '';
  loading = false;
  error: string | null = null;
  success: string | null = null;

  private auth = inject(AuthService);
  private router = inject(Router);

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
    this.success = null;

    if (!this.passwordsMatch) {
      this.error = 'Passwords do not match.';
      return;
    }

    this.loading = true;
    this.auth.signup(this.email, this.password, this.displayName).subscribe({
      next: () => {
        this.success =
          'Account created. An administrator must approve your account before you can log in.';
        this.loading = false;
        setTimeout(() => this.router.navigate(['/login']), 2500);
      },
      error: (err) => {
        this.error = err.error?.message || 'Signup failed.';
        this.loading = false;
      },
    });
  }
}
