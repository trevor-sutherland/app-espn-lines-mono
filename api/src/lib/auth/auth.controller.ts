import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt/jwt-auth.guard';

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

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    const userId =
      (req.user as { userId?: string } | undefined)?.userId || '';
    return this.authService.getProfile(userId);
  }

  @Patch('me/display-name')
  @UseGuards(JwtAuthGuard)
  async updateDisplayName(
    @Req() req: Request,
    @Body() body: { displayName: string },
  ) {
    const userId =
      (req.user as { userId?: string } | undefined)?.userId || '';
    const result = await this.authService.updateDisplayName(
      userId,
      body.displayName,
    );
    return { message: 'Display name updated', displayName: result.displayName };
  }

  @Patch('me/email')
  @UseGuards(JwtAuthGuard)
  async updateEmail(
    @Req() req: Request,
    @Body() body: { email: string },
  ) {
    const userId =
      (req.user as { userId?: string } | undefined)?.userId || '';
    const result = await this.authService.updateEmail(userId, body.email);
    return {
      message:
        'Confirmation email sent. Your current email stays active until you confirm.',
      currentEmail: result.currentEmail,
      pendingEmail: result.pendingEmail,
    };
  }

  @Post('confirm-email-change')
  async confirmEmailChange(@Body() body: { token: string }) {
    const result = await this.authService.confirmEmailChange(body.token);
    return {
      message: 'Email updated',
      previousEmail: result.previousEmail,
      email: result.email,
      user: { jwtToken: result.jwtToken },
    };
  }

  /** Allow GET links from email clients that only open URLs. */
  @Get('confirm-email-change')
  async confirmEmailChangeGet(@Query('token') token: string) {
    const result = await this.authService.confirmEmailChange(token);
    return {
      message: 'Email updated',
      previousEmail: result.previousEmail,
      email: result.email,
      user: { jwtToken: result.jwtToken },
    };
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
