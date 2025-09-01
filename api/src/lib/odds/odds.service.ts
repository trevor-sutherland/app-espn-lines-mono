import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

/**
 * Minimal types from The Odds API v4 (trimmed for what we use).
 */
type OddsApiMarketKey = 'h2h' | 'spreads' | 'totals';

interface OddsApiOutcome {
  name: string; // team name, 'Over', 'Under', or 'Draw'
  price: number; // American odds (e.g., -110)
  point?: number; // line for spreads/totals
}

interface OddsApiMarket {
  key: OddsApiMarketKey;
  outcomes: OddsApiOutcome[];
}

interface OddsApiBookmaker {
  key: string; // e.g., 'draftkings'
  title: string; // e.g., 'DraftKings'
  last_update: string; // ISO timestamp
  markets: OddsApiMarket[];
}

interface OddsApiEvent {
  id: string; // event id
  sport_key: string; // e.g., 'americanfootball_nfl'
  sport_title: string; // 'NFL'
  commence_time: string; // ISO kickoff
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

/**
 * Normalized row you can persist to Mongo or return from your API.
 */
export type NormalizedOddsRow = {
  sport: string; // 'americanfootball_nfl'
  eventId: string;
  commenceTime: string; // ISO
  bookmakerKey: string; // e.g., 'draftkings'
  bookmakerTitle: string; // e.g., 'DraftKings'
  market: OddsApiMarketKey; // 'h2h' | 'spreads' | 'totals'
  selection: 'home' | 'away' | 'over' | 'under' | 'draw';
  team?: string; // for h2h we include the team name (or 'Draw')
  line: number | null; // spread/total line; null for h2h
  price: number; // American odds
  lastUpdate: string; // ISO from bookmaker.last_update
};

export type OddsApiUsage = {
  used?: number;
  remaining?: number;
  lastRequestCost?: number;
};

@Injectable()
export class OddsService {
  private readonly log = new Logger(OddsService.name);
  private readonly http: AxiosInstance;
  private readonly apiKey: string;
  private readonly defaultMarkets: string;
  private readonly defaultBookmakers: string;
  private readonly oddsFormat: 'american' | 'decimal';

  constructor() {
    this.apiKey = process.env.ODDS_API_KEY || '';
    if (!this.apiKey) {
      this.log.warn('ODDS_API_KEY is not set. Set it in your environment.');
    }
    this.defaultMarkets = process.env.ODDS_API_MARKETS || 'spreads';
    this.defaultBookmakers = process.env.ODDS_API_BOOKMAKERS || 'draftkings';
    this.oddsFormat =
      (process.env.ODDS_API_FORMAT as 'american' | 'decimal') || 'american';

    this.http = axios.create({
      baseURL: 'https://api.the-odds-api.com/v4',
      timeout: 10_000,
      headers: { 'User-Agent': 'mongo-espn-line-app/1.0 (NestJS)' },
      // If you run behind a proxy/corp network, add proxy config here.
    });
  }

  /**
   * Public: fetch normalized NFL mainlines in one call.
   * @param sportKey The sport key (e.g., 'americanfootball_nfl')
   * @param opts Optional overrides (regions, markets, bookmakers, dateFormat, eventIds)
   */
  async fetchNflMainlines(
    sportKey: string,
    opts?: {
    regions?: string; // e.g., 'us' or 'us,us2' (see Odds API docs)
    markets?: string; // 'h2h,spreads,totals'
    bookmakers?: string; // comma list to target specific books (counts toward credits by group)
    dateFormat?: 'iso' | 'unix';
    eventIds?: string; // comma-separated list of event IDs to filter
  }): Promise<{
    rows: NormalizedOddsRow[];
    usage: OddsApiUsage;
    raw: OddsApiEvent[];
  }> {
    console.log(sportKey)
    const { events, usage } = await this.getSportOdds(sportKey, {
      markets: opts?.markets ?? this.defaultMarkets,
      bookmakers: opts?.bookmakers ?? this.defaultBookmakers,
      dateFormat: opts?.dateFormat ?? 'iso',
      eventIds: opts?.eventIds,
      oddsFormat: this.oddsFormat,
    });

    const rows = this.normalizeEvents(events);
    return { rows, usage, raw: events };
  }

  /**
   * Generic caller for /v4/sports/{sport}/odds
   */
  async getSportOdds(
    sportKey: string,
    params: {
      markets: string;
      bookmakers?: string;
      oddsFormat?: 'american' | 'decimal';
      dateFormat?: 'iso' | 'unix';
      eventIds?: string;
    },
  ): Promise<{ events: OddsApiEvent[]; usage: OddsApiUsage }> {
    try {
      const { data, headers } = await this.http.get<OddsApiEvent[]>(
        `/sports/${encodeURIComponent(sportKey)}/odds`,
        { params: { ...params, apiKey: this.apiKey } },
      );
      const usage = this.extractUsage(headers);
      return { events: data ?? [], usage };
    } catch (err: any) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      this.log.error(`Odds API error ${status ?? ''}: ${JSON.stringify(body)}`);
      throw err;
    }
  }

  /**
   * Useful helpers if you want to list sports or events before fetching odds.
   */
  async listSports(): Promise<{ data: any; usage: OddsApiUsage }> {
    const { data, headers } = await this.http.get('/sports', {
      params: { apiKey: this.apiKey },
    });
    return { data, usage: this.extractUsage(headers) };
  }

  async listEvents(
    sportKey: string,
  ): Promise<{ data: any; usage: OddsApiUsage }> {
    const { data, headers } = await this.http.get(
      `/sports/${encodeURIComponent(sportKey)}/events`,
      {
        params: { apiKey: this.apiKey },
      },
    );
    return { data, usage: this.extractUsage(headers) };
  }

  /**
   * Convert Odds API events into flat rows (one per market outcome).
   */
  private normalizeEvents(events: OddsApiEvent[]): NormalizedOddsRow[] {
    const rows: NormalizedOddsRow[] = [];
    for (const ev of events) {
      for (const bm of ev.bookmakers ?? []) {
        for (const mkt of bm.markets ?? []) {
          switch (mkt.key) {
            case 'h2h':
              for (const oc of mkt.outcomes ?? []) {
                rows.push({
                  sport: ev.sport_key,
                  eventId: ev.id,
                  commenceTime: ev.commence_time,
                  bookmakerKey: bm.key,
                  bookmakerTitle: bm.title,
                  market: 'h2h',
                  selection: this.mapH2HSelection(
                    oc.name,
                    ev.home_team,
                    ev.away_team,
                  ),
                  team: oc.name,
                  line: null,
                  price: oc.price,
                  lastUpdate: bm.last_update,
                });
              }
              break;

            case 'spreads':
              for (const oc of mkt.outcomes ?? []) {
                rows.push({
                  sport: ev.sport_key,
                  eventId: ev.id,
                  commenceTime: ev.commence_time,
                  bookmakerKey: bm.key,
                  bookmakerTitle: bm.title,
                  market: 'spreads',
                  selection: this.mapHomeAway(
                    oc.name,
                    ev.home_team,
                    ev.away_team,
                  ),
                  team: oc.name,
                  line: oc.point ?? null,
                  price: oc.price,
                  lastUpdate: bm.last_update,
                });
              }
              break;

            case 'totals':
              for (const oc of mkt.outcomes ?? []) {
                rows.push({
                  sport: ev.sport_key,
                  eventId: ev.id,
                  commenceTime: ev.commence_time,
                  bookmakerKey: bm.key,
                  bookmakerTitle: bm.title,
                  market: 'totals',
                  selection: this.mapOverUnder(oc.name),
                  team: oc.name,
                  line: oc.point ?? null,
                  price: oc.price,
                  lastUpdate: bm.last_update,
                });
              }
              break;
          }
        }
      }
    }
    return rows;
  }

  private mapH2HSelection(
    name: string,
    home: string,
    away: string,
  ): 'home' | 'away' | 'draw' {
    const n = name.toLowerCase();
    if (n === 'draw') return 'draw';
    if (n === home.toLowerCase()) return 'home';
    if (n === away.toLowerCase()) return 'away';
    // Fallback: try partial match
    if (home.toLowerCase().includes(n) || n.includes(home.toLowerCase()))
      return 'home';
    if (away.toLowerCase().includes(n) || n.includes(away.toLowerCase()))
      return 'away';
    return 'draw';
  }

  private mapHomeAway(
    name: string,
    home: string,
    away: string,
  ): 'home' | 'away' {
    const n = name.toLowerCase();
    return n === home.toLowerCase() || home.toLowerCase().includes(n)
      ? 'home'
      : 'away';
  }

  private mapOverUnder(name: string): 'over' | 'under' {
    const n = name.toLowerCase();
    return n.startsWith('o') ? 'over' : 'under';
  }

  private extractUsage(headers: Record<string, any>): OddsApiUsage {
    const used = Number(
      headers['x-requests-used'] ?? headers['x-requests-used-per-month'],
    );
    const remaining = Number(headers['x-requests-remaining']);
    const lastRequestCost = Number(headers['x-requests-last']);
    return {
      used: Number.isFinite(used) ? used : undefined,
      remaining: Number.isFinite(remaining) ? remaining : undefined,
      lastRequestCost: Number.isFinite(lastRequestCost)
        ? lastRequestCost
        : undefined,
    };
  }
}
