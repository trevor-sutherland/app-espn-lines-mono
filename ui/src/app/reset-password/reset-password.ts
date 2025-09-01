import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reset-password.html',
})
export class ResetPasswordComponent {
  password = '';
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

  onSubmit() {
    this.loading = true;
    this.auth.resetPassword(this.email, this.token, this.password).subscribe({
      next: () => {
        this.success = true;
        this.loading = false;
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (err) => {
        this.error = err.error?.message || 'Reset failed.';
        this.loading = false;
      }
    });
  }
}
