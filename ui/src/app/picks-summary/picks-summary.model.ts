export interface IPickSummary {
  _id: string;
  userId?: { displayName?: string };
  eventId?: string;
  team: string;
  market?: 'spreads' | 'totals';
  line: number;
  season: number;
  week: number;
  sportKey?: string;
  awayTeam?: string | null;
  homeTeam?: string | null;
  status: string;
  margin?: number | null;
  supercharged?: boolean;
  createdAt: Date;
}
