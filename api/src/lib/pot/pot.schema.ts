import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ _id: false })
export class PotPayment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, default: false })
  paid: boolean;

  @Prop()
  paidAt?: Date;
}

export const PotPaymentSchema = SchemaFactory.createForClass(PotPayment);

@Schema({ timestamps: true })
export class SeasonPot {
  /** Same season year used by picks / results (July+ rule). */
  @Prop({ required: true, unique: true })
  season: number;

  /** Total pot for the season in dollars (e.g. 500). */
  @Prop({ required: true, default: 0, min: 0 })
  potAmount: number;

  /**
   * Admin fee as a percent of the pot (0–100).
   * Player share = (pot + admin fee) ÷ player count.
   */
  @Prop({ required: true, default: 0, min: 0, max: 100 })
  adminFeePercent: number;

  @Prop({ type: [PotPaymentSchema], default: [] })
  payments: PotPayment[];
}

export type SeasonPotDocument = HydratedDocument<SeasonPot>;
export const SeasonPotSchema = SchemaFactory.createForClass(SeasonPot);
SeasonPotSchema.index({ season: 1 }, { unique: true });
