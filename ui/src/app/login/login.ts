import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { inject, OnDestroy } from '@angular/core';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { LoginResponse } from '../interfaces/login-response.interface';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login implements OnDestroy {
  email = '';
  password = '';
  loading = false;
  error: string | null = null;
  success: string | null = null;
  private auth = inject(AuthService);
  private router = inject(Router);
  private authSubscription: Subscription | null = null;

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
          localStorage.setItem('jwtToken', res.user.jwtToken);
          this.loading = false;
          this.router.navigate(['/pick']);
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
