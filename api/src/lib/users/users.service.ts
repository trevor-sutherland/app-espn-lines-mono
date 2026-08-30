import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as argon2 from 'argon2';
import { User, UserDocument, UserRole } from './users.schema';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  approved: boolean;
  active: boolean;
  createdAt?: Date;
};

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async onModuleInit() {
    void this.userModel
      .updateMany({ active: { $exists: false } }, { $set: { active: true } })
      .exec()
      .catch(() => undefined);
  }

  private toPublic(user: UserDocument): PublicUser {
    return {
      id: String(user._id),
      email: user.email,
      displayName: user.displayName,
      role: user.role ?? 'user',
      approved: !!user.approved,
      active: user.active !== false,
      createdAt: (user as UserDocument & { createdAt?: Date }).createdAt,
    };
  }

  async listUsers(): Promise<PublicUser[]> {
    const users = await this.userModel
      .find()
      .sort({ createdAt: -1 })
      .exec();
    return users.map((u) => this.toPublic(u));
  }

  async createUser(dto: CreateUserDto): Promise<PublicUser> {
    const email = dto.email.trim().toLowerCase();
    const displayName = dto.displayName.trim();
    if (!displayName) {
      throw new BadRequestException('Display name is required');
    }
    const existing = await this.userModel.findOne({ email });
    if (existing) {
      throw new ConflictException('Email already in use');
    }
    const role: UserRole = dto.role === 'admin' ? 'admin' : 'user';
    const user = await this.userModel.create({
      email,
      passwordHash: await argon2.hash(dto.password),
      displayName,
      role,
      approved: true,
      active: true,
    });
    return this.toPublic(user);
  }

  async updateUser(userId: string, dto: UpdateUserDto): Promise<PublicUser> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const displayName = dto.displayName.trim();
    if (!displayName) {
      throw new BadRequestException('Display name is required');
    }

    const email = dto.email.trim().toLowerCase();
    if (email !== user.email) {
      const taken = await this.userModel.findOne({
        email,
        _id: { $ne: user._id },
      });
      if (taken) {
        throw new ConflictException('Email already in use');
      }
      user.email = email;
      user.pendingEmail = undefined;
      user.emailChangeToken = undefined;
      user.emailChangeTokenExpires = undefined;
    }

    user.displayName = displayName;
    if (dto.password) {
      user.passwordHash = await argon2.hash(dto.password);
    }
    await user.save();
    return this.toPublic(user);
  }

  async setApproved(userId: string, approved: boolean): Promise<PublicUser> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    user.approved = approved;
    await user.save();
    return this.toPublic(user);
  }

  async setRole(userId: string, role: UserRole): Promise<PublicUser> {
    if (role !== 'user' && role !== 'admin') {
      throw new BadRequestException('Invalid role');
    }
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    user.role = role;
    // Admins are always treated as approved + active
    if (role === 'admin') {
      user.approved = true;
      user.active = true;
    }
    await user.save();
    return this.toPublic(user);
  }

  async setActive(
    userId: string,
    active: boolean,
    actorUserId: string,
  ): Promise<PublicUser> {
    if (userId === actorUserId && !active) {
      throw new BadRequestException('You cannot deactivate your own account');
    }
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    user.active = active;
    await user.save();
    return this.toPublic(user);
  }
}
