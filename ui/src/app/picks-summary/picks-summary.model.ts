export interface IPickSummary {
  _id: string;
  userId: { displayName: string };
  team: string;
  line: number;
  season: number;
  week: number;
  status: string;
  createdAt: Date;
}
