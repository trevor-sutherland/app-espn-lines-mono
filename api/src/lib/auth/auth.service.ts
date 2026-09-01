import {
  Injectable,
  Logger,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/users.schema';
import { resolveUserSports } from '../utils/sports';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { MailerService } from '@nestjs-modules/mailer';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly log = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private mailerService: MailerService,
    private jwtService: JwtService,
  ) {}

  async onModuleInit() {
    // Do not block Cloud Run listen() on Mongo being reachable.
    void this.seedOnStartup().catch((err) =>
      this.log.error(
        err instanceof Error ? err.stack ?? err.message : String(err),
      ),
    );
  }

  private async seedOnStartup() {
    // Existing accounts (pre-approval field) keep access
    await this.userModel.updateMany(
      { approved: { $exists: false } },
      { $set: { approved: true } },
    );
    await this.ensureAdminUser();
  }

  /** Seed/sync the admin account from ADMIN_EMAIL / ADMIN_PASSWORD in env. */
  private async ensureAdminUser() {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      this.log.warn(
        'ADMIN_EMAIL or ADMIN_PASSWORD is not set; skipping admin seed.',
      );
      return;
    }

    const displayName =
      process.env.ADMIN_DISPLAY_NAME?.trim() || 'Admin';
    const passwordHash = await argon2.hash(password);
    const existing = await this.userModel.findOne({ email });

    if (existing) {
      existing.passwordHash = passwordHash;
      existing.role = 'admin';
      existing.approved = true;
      existing.active = true;
      if (!existing.displayName) {
        existing.displayName = displayName;
      }
      await existing.save();
      this.log.log(`Ensured admin user exists: ${email}`);
      return;
    }

    await this.userModel.create({
      email,
      passwordHash,
      displayName,
      role: 'admin',
      approved: true,
      active: true,
    });
    this.log.log(`Created admin user: ${email}`);
  }

  async createUser(email: string, password: string, displayName?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (adminEmail && normalizedEmail === adminEmail) {
      throw new ConflictException('Email already in use');
    }

    const existing = await this.userModel.findOne({ email: normalizedEmail });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await argon2.hash(password);

    const user = new this.userModel({
      email: normalizedEmail,
      passwordHash,
      displayName,
      role: 'user',
      approved: false,
      active: true,
    });
    await user.save();
    return {
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      approved: user.approved,
      active: user.active,
      id: user._id,
    };
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(userId: string) {
    return this.userModel.findById(userId).exec();
  }

  async updateDisplayName(
    userId: string,
    displayName: string,
  ): Promise<{ displayName: string }> {
    const trimmed = displayName?.trim();
    if (!trimmed) {
      throw new BadRequestException('Display name is required');
    }
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { displayName: trimmed },
      { new: true },
    );
    if (!user) throw new NotFoundException('User not found');
    return { displayName: user.displayName };
  }

  async login(email: string, password: string): Promise<{ jwtToken: string }> {
    const user = await this.userModel.findOne({
      email: email.trim().toLowerCase(),
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const validPass = await argon2.verify(user.passwordHash, password);
    if (!validPass) throw new UnauthorizedException('Invalid credentials');

    if (!user.approved) {
      throw new ForbiddenException(
        'Access pending — an administrator must approve your account before you can log in.',
      );
    }

    if (user.active === false) {
      throw new ForbiddenException(
        'This account is inactive. Contact an administrator.',
      );
    }

    return { jwtToken: await this.signToken(user) };
  }

  async updateEmail(
    userId: string,
    newEmail: string,
  ): Promise<{ currentEmail: string; pendingEmail: string }> {
    const normalized = newEmail?.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) {
      throw new BadRequestException('A valid email is required');
    }

    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (user.email === normalized) {
      throw new BadRequestException('That is already your current email');
    }

    const taken = await this.userModel.findOne({
      $or: [{ email: normalized }, { pendingEmail: normalized }],
      _id: { $ne: user._id },
    });
    if (taken) throw new ConflictException('Email already in use');

    const token = crypto.randomBytes(32).toString('hex');
    user.pendingEmail = normalized;
    user.emailChangeToken = token;
    user.emailChangeTokenExpires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
    await user.save();

    const confirmUrl = `${process.env.WEB_APP_URL || 'http://localhost:4200'}/confirm-email-change?token=${token}`;
    try {
      const result = await this.mailerService.sendMail({
        to: normalized,
        subject: 'Confirm your new email — Spreadhead Picks',
        template: 'email-change',
        context: {
          url: confirmUrl,
          currentEmail: user.email,
          pendingEmail: normalized,
        },
      });
      this.log.log(`Email change confirmation sent to ${normalized}`);
      this.log.debug(`Mailer result: ${JSON.stringify(result)}`);
    } catch (err) {
      this.log.error('Failed to send email change confirmation', err);
      // Roll back pending so user can retry
      user.pendingEmail = undefined;
      user.emailChangeToken = undefined;
      user.emailChangeTokenExpires = undefined;
      await user.save();
      throw err;
    }

    return { currentEmail: user.email, pendingEmail: normalized };
  }

  async confirmEmailChange(token: string): Promise<{
    previousEmail: string;
    email: string;
    jwtToken: string;
  }> {
    if (!token?.trim()) {
      throw new BadRequestException('Confirmation token is required');
    }

    const user = await this.userModel.findOne({ emailChangeToken: token.trim() });
    if (
      !user ||
      !user.pendingEmail ||
      !user.emailChangeTokenExpires ||
      user.emailChangeTokenExpires < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired confirmation link');
    }

    const previousEmail = user.email;
    const newEmail = user.pendingEmail;

    const taken = await this.userModel.findOne({
      email: newEmail,
      _id: { $ne: user._id },
    });
    if (taken) {
      throw new ConflictException('Email already in use');
    }

    user.email = newEmail;
    user.pendingEmail = undefined;
    user.emailChangeToken = undefined;
    user.emailChangeTokenExpires = undefined;
    await user.save();

    return {
      previousEmail,
      email: user.email,
      jwtToken: await this.signToken(user),
    };
  }

  async getProfile(userId: string): Promise<{
    email: string;
    pendingEmail: string | null;
    displayName: string;
  }> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return {
      email: user.email,
      pendingEmail: user.pendingEmail ?? null,
      displayName: user.displayName,
    };
  }

  private async signToken(user: UserDocument): Promise<string> {
    const payload = {
      email: user.email,
      sub: user._id,
      role: user.role ?? 'user',
      sports: resolveUserSports(user.sports),
    };
    return this.jwtService.signAsync(payload);
  }

  async sendPasswordResetEmail(email: string) {
    const normalized = email?.trim().toLowerCase();
    const user = await this.userModel.findOne({ email: normalized });
    if (!user) {
      this.log.warn(`No user found for password reset email: ${normalized}`);
      return;
    }
    try {
      const token = crypto.randomBytes(32).toString('hex');
      user.resetToken = token;
      user.resetTokenExpires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
      await user.save();
      const webAppUrl = process.env.WEB_APP_URL || 'http://localhost:4200';
      const result = await this.mailerService.sendMail({
        to: normalized,
        subject: 'Password Reset — Spreadhead Picks',
        template: 'password-reset',
        context: {
          url: `${webAppUrl}/reset-password?token=${token}&email=${encodeURIComponent(normalized)}`,
        },
      });
      this.log.log(`Password reset email sent to ${normalized}`);
      this.log.debug(`Mailer result: ${JSON.stringify(result)}`);
    } catch (err) {
      this.log.error('Failed to send password reset email', err);
      throw err;
    }
  }

  async resetPassword(email: string, token: string, password: string) {
    const normalized = email?.trim().toLowerCase();
    const user = await this.userModel.findOne({
      email: normalized,
      resetToken: token,
    });
    if (
      !user ||
      !user.resetTokenExpires ||
      user.resetTokenExpires < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
    user.passwordHash = await argon2.hash(password);
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    await user.save();
  }
}
