import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Pick {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, index: true }) season: number;
  @Prop({ required: true, index: true }) week: number;
  @Prop({ required: true, index: true }) eventId: string;

  // Odds snapshot at pick time (immutable)
  @Prop({ required: true }) team: string;
  @Prop({ type: Number }) line: number | null;
  @Prop({ required: true }) lockedAt: Date;
  @Prop({ default: 'pending', enum: ['pending', 'won', 'lost', 'void'] })
  status: string;
}
export type PickDocument = Pick & Document;
export const PickSchema = SchemaFactory.createForClass(Pick);

// Enforce one pick per user per week (classic pick’em)
PickSchema.index({ userId: 1, season: 1, week: 1 }, { unique: true });
