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

  @Prop({ required: true })
  market: string; // 'h2h' | 'spreads' | 'totals'

  @Prop({ required: true })
  selection: string; // e.g., 'home' | 'away' | 'draw' | team name

  @Prop()
  team?: string; // team name when applicable (spreads/totals selection mapping)

  @Prop({ type: Number, default: null })
  line: number | null; // spread or total line; null for h2h

  @Prop({ required: true })
  price: number; // American price

  @Prop({ required: true })
  lastUpdate: string; // ISO timestamp from Odds API (bookmaker.market.last_update)
}

export type OddsLatestDocument = OddsLatest & Document;
export const OddsLatestSchema = SchemaFactory.createForClass(OddsLatest);

// Ensure one latest row per unique quote
OddsLatestSchema.index(
  { sport: 1, eventId: 1, bookmakerKey: 1, market: 1, selection: 1, team: 1 },
  { unique: true }
);