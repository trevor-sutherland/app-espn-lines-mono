export interface IStandingRow {
  userId: string;
  displayName: string;
  wins: number;
  losses: number;
  voids: number;
  /** Net from supercharged picks only (+1 win, −1 loss). */
  superchargePoints: number;
  points: number;
}
