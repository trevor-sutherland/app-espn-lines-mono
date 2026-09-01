export interface IPickSummary {
  _id: string;
  userId?: { displayName?: string };
  team: string;
  market?: 'spreads' | 'totals';
  line: number;
  season: number;
  week: number;
  sportKey?: string;
  status: string;
  margin?: number | null;
  supercharged?: boolean;
  createdAt: Date;
}
