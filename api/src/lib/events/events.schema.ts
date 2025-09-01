import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

class TeamRef {
  @Prop({ required: true }) id: string; // provider's team id/key
  @Prop({ required: true }) name: string; // "Dallas Cowboys"
  @Prop() abbr?: string; // "DAL"
}

@Schema({ timestamps: true })
export class Event {
  @Prop({ required: true, unique: true }) eventId: string;
  @Prop({ required: true, index: true }) season: number;
  @Prop({ required: true, index: true }) week: number; // NFL week (1..18)
  @Prop({ required: true }) commenceTime: Date;
  @Prop({ type: TeamRef, required: true }) homeTeam: TeamRef;
  @Prop({ type: TeamRef, required: true }) awayTeam: TeamRef;
  @Prop({
    default: 'scheduled',
    enum: ['scheduled', 'live', 'final', 'canceled'],
  })
  status: string;
}
export type EventDocument = Event & Document;
export const EventSchema = SchemaFactory.createForClass(Event);
EventSchema.index({ season: 1, week: 1 });
