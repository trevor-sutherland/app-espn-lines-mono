import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole } from './users.schema';

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
    // Backfill active for users created before this field existed
    await this.userModel.updateMany(
      { active: { $exists: false } },
      { $set: { active: true } },
    );
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
