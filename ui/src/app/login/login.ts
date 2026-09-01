import { Component, ChangeDetectionStrategy, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { LoginResponse } from './login-response.interface';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './login.scss'
})
export class Login implements OnInit, OnDestroy {
  email = '';
  password = '';
  loading = false;
  error: string | null = null;
  success: string | null = null;
  private auth = inject(AuthService);
  private router = inject(Router);
  private authSubscription: Subscription | null = null;

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/home']);
    }
  }

  onSubmit(e: Event) {
    e.preventDefault();
    this.loading = true;
    this.error = null;
    this.success = null;

    this.authSubscription = this.auth.login(this.email, this.password).subscribe({
      next: (res: LoginResponse) => {
        console.log(res)
        if (res && res.user && res.user.jwtToken) {
          this.success = 'Login successful!';
          this.loading = false;
          this.router.navigate(['/home']);
        } else {
          this.error = res.message || 'Login failed.';
          this.loading = false;
        }
      },
      error: (err) => {
        this.error = err.error?.message || 'Login failed.';
        this.loading = false;
      },
    });
  }

    onSignup() {
      console.log('signup clicked');
      this.router.navigate(['/signup']);
  }

  onPwReset() {
      console.log('pw reset Clicked');
      this.router.navigate(['/forgot-password']);
  }

    ngOnDestroy(): void {
      this.authSubscription?.unsubscribe();
    }
}
