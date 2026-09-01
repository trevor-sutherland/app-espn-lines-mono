export type PickAnnouncementMarket = 'spreads' | 'totals';

export type PickAnnouncementInput = {
  displayName: string;
  market: PickAnnouncementMarket;
  team: string;
  line: number | null | undefined;
  loy: boolean;
  awayTeam?: string;
  homeTeam?: string;
};

/** Same signed-line rules as the Picks UI helper. */
export function formatAnnouncementLine(
  line: number | null | undefined,
): string {
  if (line == null || Number.isNaN(Number(line))) {
    return '';
  }
  const n = Number(line);
  return `${n > 0 ? '+' : ''}${n}`;
}

export function formatAnnouncementTotal(
  line: number | null | undefined,
): string {
  if (line == null || Number.isNaN(Number(line))) {
    return '';
  }
  return String(Number(line));
}

/**
 * Plain-text iMessage body for a saved pick. No extra wrapping text.
 * Returns null only when the player name or line cannot be formed.
 */
export function formatPickAnnouncement(
  input: PickAnnouncementInput,
): string | null {
  const displayName = input.displayName.trim();
  if (!displayName) return null;

  const loySuffix = input.loy ? ' LOY🔥' : '';

  if (input.market === 'totals') {
    const total = formatAnnouncementTotal(input.line);
    if (!total) return null;
    const side = input.team.trim().toLowerCase() === 'under' ? 'u' : 'o';
    const away = input.awayTeam?.trim();
    const home = input.homeTeam?.trim();
    const matchup =
      away && home ? `${away}/${home} ${side}${total}` : `${side === 'u' ? 'Under' : 'Over'} ${total}`;
    return `🔒 ${displayName} locked in ${matchup} 🏈${loySuffix}`;
  }

  const team = input.team.trim();
  const line = formatAnnouncementLine(input.line);
  if (!team || !line) return null;
  return `🔒 ${displayName} locked in ${team} ${line} 🏈${loySuffix}`;
}

/** Unique per player so Yahoo does not collapse every pick into one thread. */
export function formatPickAnnouncementSubject(displayName: string): string {
  const name = displayName.trim() || 'pick';
  return `LOCKSONLY — ${name}`;
}

/**
 * Compact pick label for scoreboard / activity (no player name wrapper).
 */
export function formatPickSelectionLabel(input: {
  market: PickAnnouncementMarket;
  team: string;
  line: number | null | undefined;
  loy?: boolean;
  awayTeam?: string;
  homeTeam?: string;
}): string | null {
  const loySuffix = input.loy ? ' LOY🔥' : '';
  if (input.market === 'totals') {
    const away = input.awayTeam?.trim();
    const home = input.homeTeam?.trim();
    if (!away || !home) return null;
    const side = input.team.trim().toLowerCase() === 'under' ? 'u' : 'o';
    const total = formatAnnouncementTotal(input.line);
    if (!total) return null;
    return `${away}/${home} ${side}${total}${loySuffix}`;
  }
  const team = input.team.trim();
  const line = formatAnnouncementLine(input.line);
  if (!team || !line) return null;
  return `${team} ${line}${loySuffix}`;
}
