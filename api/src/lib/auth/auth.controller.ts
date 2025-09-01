import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(
    @Body() body: { email: string; password: string; displayName?: string },
  ) {
    const user = await this.authService.createUser(
      body.email,
      body.password,
      body.displayName,
    );
    return { message: 'Signup successful', user };
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    console.log('Login attempt:', body.email);
    const user = await this.authService.login(body.email, body.password);
    return { message: 'Login successful', user };
  }

  @Post('request-password-reset')
  async requestPasswordReset(@Body() body: { email: string }) {
    await this.authService.sendPasswordResetEmail(body.email);
    // Always return success for security
    return {
      message: 'If that email is registered, a reset link has been sent.',
    };
  }

  @Post('reset-password')
  async resetPassword(
    @Body() body: { email: string; token: string; password: string },
  ) {
    await this.authService.resetPassword(body.email, body.token, body.password);
    return { message: 'Password reset successful' };
  }
}
