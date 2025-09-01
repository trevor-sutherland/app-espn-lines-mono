import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class OddsLatest {
  @Prop({ required: true })
  sport: string;

  @Prop({ required: true })
  eventId: string;

  @Prop({ required: true })
  commenceTime: string;

  @Prop({ required: true })
  bookmakerKey: string;

  @Prop({ required: true })
  bookmakerTitle: string;

  // Add more fields as needed for picks (e.g., market, selection, team, line, price)
  @Prop()
  market?: string;

  @Prop()
  selection?: string;

  @Prop()
  team?: string;

  @Prop()
  line?: number;

  @Prop()
  price?: number;

  @Prop()
  lastUpdate?: string;
}

export type OddsLatestDocument = OddsLatest & Document;
export const OddsLatestSchema = SchemaFactory.createForClass(OddsLatest);
