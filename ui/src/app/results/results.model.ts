export interface IStandingRow {
  userId: string;
  displayName: string;
  wins: number;
  losses: number;
  voids: number;
  /** Net from LOY picks only (+1 win bonus, −1 loss, −1 push). */
  superchargePoints: number;
  points: number;
}
