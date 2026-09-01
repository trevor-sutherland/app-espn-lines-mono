export const ALL_SPORT_KEYS = [
  'americanfootball_nfl',
  'americanfootball_ncaaf',
  'basketball_nba',
  'basketball_ncaab',
] as const;

export type SportKey = (typeof ALL_SPORT_KEYS)[number];

const ALLOWED = new Set<string>(ALL_SPORT_KEYS);

export function isSportKey(value: string): value is SportKey {
  return ALLOWED.has(value);
}

/** Valid sport from a query/body value, or null if missing/invalid. */
export function parseSportQuery(value?: string | null): SportKey | null {
  if (!value) return null;
  return isSportKey(value) ? value : null;
}

/** Unique valid keys from the client. Empty if none are valid. */
export function parseSports(sports?: string[] | null): SportKey[] {
  if (!sports?.length) return [];
  return [...new Set(sports.filter(isSportKey))];
}

/**
 * Sports shown in the dropdown.
 * Missing/empty on older users means all sports (same as today).
 */
export function resolveUserSports(sports?: string[] | null): SportKey[] {
  const parsed = parseSports(sports);
  return parsed.length ? parsed : [...ALL_SPORT_KEYS];
}
