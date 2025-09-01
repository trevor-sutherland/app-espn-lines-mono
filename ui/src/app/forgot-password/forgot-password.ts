import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './forgot-password.html',
})
export class ForgotPasswordComponent {
  email = '';
  submitted = false;
  loading = false;

  private auth = inject(AuthService);

  onSubmit() {
    this.loading = true;
    this.auth.requestPasswordReset(this.email).subscribe(() => {
      this.submitted = true;
      this.loading = false;
    });
  }
}
