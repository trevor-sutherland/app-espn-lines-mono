import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class OddsUsage {
  @Prop({ required: true, unique: true, default: 'default' })
  key: string;

  @Prop({ type: Number, default: null })
  used: number | null;

  @Prop({ type: Number, default: null })
  remaining: number | null;

  @Prop({ type: Number, default: null })
  lastCost: number | null;

  @Prop({ type: Date, default: null })
  lastCalledAt: Date | null;

  @Prop({ default: '' })
  lastPath: string;

  @Prop({ default: false })
  quotaExceeded: boolean;
}

export type OddsUsageDocument = OddsUsage & Document;
export const OddsUsageSchema = SchemaFactory.createForClass(OddsUsage);
