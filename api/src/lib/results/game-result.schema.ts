import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class GameResult {
  @Prop({ required: true, unique: true, index: true })
  eventId: string;

  @Prop({ required: true, index: true })
  sportKey: string;

  @Prop({ required: true })
  commenceTime: Date;

  @Prop({ required: true })
  homeTeam: string;

  @Prop({ required: true })
  awayTeam: string;

  @Prop({ required: true })
  homeScore: number;

  @Prop({ required: true })
  awayScore: number;

  @Prop({ required: true, default: true })
  completed: boolean;

  @Prop({ type: Date })
  lastUpdate: Date | null;
}

export type GameResultDocument = GameResult & Document;
export const GameResultSchema = SchemaFactory.createForClass(GameResult);
