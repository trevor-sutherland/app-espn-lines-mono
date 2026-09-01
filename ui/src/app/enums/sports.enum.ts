export enum SportsEnum {
  NFL = 'americanfootball_nfl',
  NCAAF = 'americanfootball_ncaaf',
  NBA = 'basketball_nba',
  NCAAB = 'basketball_ncaab'
}

export const ALL_SPORT_KEYS = [
  SportsEnum.NFL,
  SportsEnum.NCAAF,
  SportsEnum.NBA,
  SportsEnum.NCAAB,
] as const;

export type SportKey = (typeof ALL_SPORT_KEYS)[number];

export const SPORT_OPTIONS: { key: SportKey; label: string }[] = [
  { key: SportsEnum.NFL, label: 'NFL' },
  { key: SportsEnum.NCAAF, label: 'NCAAF' },
  { key: SportsEnum.NBA, label: 'NBA' },
  { key: SportsEnum.NCAAB, label: 'NCAAB' },
];

export function resolveUserSports(sports?: string[] | null): SportKey[] {
  const allowed = new Set<string>(ALL_SPORT_KEYS);
  const parsed = [...new Set((sports ?? []).filter((key): key is SportKey => allowed.has(key)))];
  return parsed.length ? parsed : [...ALL_SPORT_KEYS];
}