export type StandingAcc = {
  displayName: string;
  wins: number;
  losses: number;
  voids: number;
  superchargePoints: number;
  points: number;
};

export function emptyStanding(displayName: string): StandingAcc {
  return {
    displayName,
    wins: 0,
    losses: 0,
    voids: 0,
    superchargePoints: 0,
    points: 0,
  };
}

/**
 * Apply one graded pick using the Results page rules:
 * win +1, LOY win +2, LOY loss −1, LOY push −1, regular push 0.
 * Pending picks are ignored.
 */
export function applyGradedPick(
  entry: StandingAcc,
  status: string,
  supercharged: boolean,
): void {
  if (status === 'won') {
    entry.wins += 1;
    entry.points += 1;
    if (supercharged) {
      entry.superchargePoints += 1;
      entry.points += 1;
    }
    return;
  }
  if (status === 'lost') {
    entry.losses += 1;
    if (supercharged) {
      entry.superchargePoints -= 1;
      entry.points -= 1;
    }
    return;
  }
  if (status === 'void') {
    entry.voids += 1;
    if (supercharged) {
      entry.superchargePoints -= 1;
      entry.points -= 1;
    }
  }
}

export function pointsForPick(status: string, supercharged: boolean): number {
  const acc = emptyStanding('');
  applyGradedPick(acc, status, supercharged);
  return acc.points;
}

export function formatRecord(wins: number, losses: number, voids: number): string {
  return `${wins}-${losses}-${voids}`;
}

/** Same order as GET /results/standings: points desc, then display name. */
export function compareStandings(
  a: { points: number; displayName: string },
  b: { points: number; displayName: string },
): number {
  return b.points - a.points || a.displayName.localeCompare(b.displayName);
}

export function resolvePickMarket(
  market: string | undefined | null,
  team: string,
): 'spreads' | 'totals' {
  if (market === 'totals' || market === 'spreads') {
    return market;
  }
  const name = (team || '').trim().toLowerCase();
  if (name === 'over' || name === 'under') {
    return 'totals';
  }
  return 'spreads';
}

export function isGradedStatus(status: string): boolean {
  return status === 'won' || status === 'lost' || status === 'void';
}
