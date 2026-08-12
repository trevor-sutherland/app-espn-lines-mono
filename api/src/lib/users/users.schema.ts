import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserRole = 'user' | 'admin';

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true }) // argon2 hash
  passwordHash: string;

  @Prop({ required: true })
  displayName: string;

  @Prop({ required: true, enum: ['user', 'admin'], default: 'user' })
  role: UserRole;

  /** New signups start false; admin must approve before login works. */
  @Prop({ required: true, default: false })
  approved: boolean;

  /** Soft-deactivate instead of delete. Inactive users cannot log in. */
  @Prop({ required: true, default: true })
  active: boolean;

  @Prop()
  resetToken?: string;

  @Prop()
  resetTokenExpires?: Date;

  /** Pending email awaiting confirmation link; login still uses `email` until confirmed. */
  @Prop({ lowercase: true, trim: true })
  pendingEmail?: string;

  @Prop()
  emailChangeToken?: string;

  @Prop()
  emailChangeTokenExpires?: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 }, { unique: true });
