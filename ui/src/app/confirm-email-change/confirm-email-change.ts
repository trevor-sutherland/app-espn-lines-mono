import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-confirm-email-change',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './confirm-email-change.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ConfirmEmailChangeComponent implements OnInit {
  loading = true;
  error: string | null = null;
  previousEmail: string | null = null;
  email: string | null = null;

  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!token) {
      this.error = 'Missing confirmation token.';
      this.loading = false;
      return;
    }

    this.auth.confirmEmailChange(token).subscribe({
      next: (res) => {
        this.previousEmail = res.previousEmail;
        this.email = res.email;
        this.loading = false;
      },
      error: (err) => {
        this.error =
          err?.error?.message ||
          'This confirmation link is invalid or has expired.';
        this.loading = false;
      },
    });
  }
}
