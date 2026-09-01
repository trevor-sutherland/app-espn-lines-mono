export type PickMarket = 'spreads' | 'totals';

export function resolvePickMarket(
  market: string | null | undefined,
  team: string | null | undefined,
): PickMarket {
  if (market === 'totals' || market === 'spreads') {
    return market;
  }
  const name = (team || '').trim().toLowerCase();
  if (name === 'over' || name === 'under') {
    return 'totals';
  }
  return 'spreads';
}

export function formatSignedLine(line: number | null | undefined): string {
  if (line == null || Number.isNaN(Number(line))) {
    return '—';
  }
  const n = Number(line);
  return `${n > 0 ? '+' : ''}${n}`;
}

export function formatTotalPoint(line: number | null | undefined): string {
  if (line == null || Number.isNaN(Number(line))) {
    return '—';
  }
  return String(Number(line));
}

export function formatPickLabel(
  team: string,
  line: number | null | undefined,
  market?: string | null,
  matchup?: { awayTeam?: string | null; homeTeam?: string | null },
): string {
  const resolved = resolvePickMarket(market, team);
  if (resolved === 'totals') {
    const away = matchup?.awayTeam?.trim();
    const home = matchup?.homeTeam?.trim();
    if (away && home) {
      const side = team.trim().toLowerCase() === 'under' ? 'u' : 'o';
      return `${away}/${home} ${side}${formatTotalPoint(line)}`;
    }
    const side = team.trim().toLowerCase() === 'under' ? 'Under' : 'Over';
    return `${side} ${formatTotalPoint(line)}`;
  }
  return `${team} ${formatSignedLine(line)}`;
}

export function formatTotalButton(
  side: 'Over' | 'Under',
  line: number | null | undefined,
): string {
  const prefix = side === 'Under' ? 'U' : 'O';
  return `${prefix} ${formatTotalPoint(line)}`;
}
