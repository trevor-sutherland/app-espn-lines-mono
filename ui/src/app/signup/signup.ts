import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.scss'
})
export class Signup {
  email = '';
  password = '';
  displayName = '';
  loading = false;
  error: string | null = null;
  success: string | null = null;

  private auth = inject(AuthService);
  private router = inject(Router);

  onSubmit() {
    this.loading = true;
    this.error = null;
    this.success = null;

    this.auth.signup(this.email, this.password, this.displayName).subscribe({
      next: () => {
        this.success = 'Signup successful! You can now log in.';
        this.loading = false;
        setTimeout(() => this.router.navigate(['/login']), 1500);
      },
      error: (err) => {
        this.error = err.error?.message || 'Signup failed.';
        this.loading = false;
      }
    });
  }
}
