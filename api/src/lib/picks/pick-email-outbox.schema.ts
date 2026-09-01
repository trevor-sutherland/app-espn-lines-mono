import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PickEmailStatus = 'pending' | 'sending' | 'sent' | 'failed';

@Schema({ timestamps: true, collection: 'pickemailoutbox' })
export class PickEmailOutbox {
  @Prop({ type: Types.ObjectId, required: true, unique: true })
  pickId: Types.ObjectId;

  @Prop({ required: true })
  to: string;

  @Prop({ required: true })
  subject: string;

  @Prop({ required: true })
  text: string;

  @Prop({
    required: true,
    enum: ['pending', 'sending', 'sent', 'failed'],
    default: 'pending',
    index: true,
  })
  status: PickEmailStatus;

  @Prop({ required: true, index: true })
  availableAt: Date;

  @Prop({ default: 0 })
  attempts: number;

  @Prop()
  lastError?: string;

  @Prop()
  smtpResponse?: string;

  @Prop()
  sentAt?: Date;

  @Prop()
  claimedAt?: Date;
}

export type PickEmailOutboxDocument = PickEmailOutbox & Document;
export const PickEmailOutboxSchema =
  SchemaFactory.createForClass(PickEmailOutbox);

PickEmailOutboxSchema.index({ status: 1, availableAt: 1 });
