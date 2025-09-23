/**
 * Minimal types from The Odds API v4 (trimmed for what we use).
 */
export type OddsApiMarketKey = 'h2h' | 'spreads' | 'totals';

export interface OddsApiOutcome {
  name: string; // team name, 'Over', 'Under', or 'Draw'
  price: number; // American odds (e.g., -110)
  point?: number; // line for spreads/totals
}

export interface OddsApiMarket {
  key: OddsApiMarketKey;
  outcomes: OddsApiOutcome[];
}

export interface OddsApiBookmaker {
  key: string; // e.g., 'draftkings'
  title: string; // e.g., 'DraftKings'
  last_update: string; // ISO timestamp
  markets: OddsApiMarket[];
}

export interface OddsApiEvent {
  id: string; // event id
  sport_key: string; // e.g., 'americanfootball_nfl'
  sport_title: string; // 'NFL'
  commence_time: string; // ISO kickoff
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

export type NormalizedOddsRow = {
  sport: string;
  eventId: string;
  commenceTime: string;
  bookmakerKey: string;
  bookmakerTitle: string;
  market: OddsApiMarketKey;
  selection: 'home' | 'away' | 'over' | 'under' | 'draw';
  team?: string;
  line: number | null;
  price: number;
  lastUpdate: string;
};

export type OddsApiUsage = {
  used?: number;
  remaining?: number;
  lastRequestCost?: number;
};