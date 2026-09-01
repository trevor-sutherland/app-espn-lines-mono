import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Pick {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, index: true }) season: number;
  @Prop({ required: true, index: true }) week: number;
  @Prop({ required: true, index: true }) eventId: string;

  /** Odds API sport key. One saved pick per user per week per sport. */
  @Prop({ index: true })
  sportKey?: string;

  // Odds snapshot at pick time (immutable)
  @Prop({ required: true, default: 'spreads', enum: ['spreads', 'totals'] })
  market: 'spreads' | 'totals';
  @Prop({ required: true }) team: string;
  @Prop({ type: Number }) line: number | null;
  @Prop({ required: true }) lockedAt: Date;
  @Prop({ default: 'pending', enum: ['pending', 'won', 'lost', 'void'] })
  status: string;

  /** LOY: win = +2, loss = −1, push = −1. One per user per season per sport. */
  @Prop({ default: false })
  supercharged: boolean;
}
export type PickDocument = Pick & Document;
export const PickSchema = SchemaFactory.createForClass(Pick);

PickSchema.index(
  { userId: 1, season: 1, week: 1, sportKey: 1 },
  { unique: true, name: 'user_season_week_sport_unique' },
);

PickSchema.index(
  { userId: 1, season: 1, sportKey: 1 },
  {
    unique: true,
    name: 'user_season_sport_loy_unique',
    partialFilterExpression: { supercharged: true },
  },
);
