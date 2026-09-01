import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OddsLatest, OddsLatestDocument } from './odds.schema';
import axios, { AxiosInstance } from 'axios';
import { NormalizedOddsRow, OddsApiUsage, OddsApiEvent } from './models/odds.model';
import { isSportKey, type SportKey } from '../utils/sports';

@Injectable()
export class OddsService {
  private readonly log = new Logger(OddsService.name);
  private readonly http: AxiosInstance;
  private readonly apiKey: string;
  private readonly defaultMarkets: string;
  private readonly defaultBookmakers: string;
  private readonly oddsFormat: 'american' | 'decimal';

  constructor(
    @InjectModel(OddsLatest.name)
    private readonly oddsModel: Model<OddsLatestDocument>,
  ) {
    this.apiKey = process.env.ODDS_API_KEY || '';
    if (!this.apiKey) {
      this.log.warn('ODDS_API_KEY is not set. Set it in your environment.');
    }
    this.defaultMarkets = this.withTotalsMarket(
      process.env.ODDS_API_MARKETS || 'spreads',
    );
    this.defaultBookmakers = process.env.ODDS_API_BOOKMAKERS || 'draftkings';
    this.oddsFormat =
      (process.env.ODDS_API_FORMAT as 'american' | 'decimal') || 'american';

    this.http = axios.create({
      baseURL: 'https://api.the-odds-api.com/v4',
      timeout: 10_000,
      headers: { 'User-Agent': 'mongo-espn-line-app/1.0 (NestJS)' },
    });
  }

  async fetchSportMainlines(
    sportKey: string,
    opts?: {
      regions?: string;
      markets?: string;
      bookmakers?: string;
      dateFormat?: 'iso' | 'unix';
      eventIds?: string;
    }
  ): Promise<{
    rows: NormalizedOddsRow[];
    usage: OddsApiUsage;
    raw: OddsApiEvent[];
  }> {
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

  async fetchAndSaveSportMainlines(
    sportKey: string,
    opts?: {
      regions?: string;
      markets?: string;
      bookmakers?: string;
      dateFormat?: 'iso' | 'unix';
      eventIds?: string;
      allowInsert?: boolean;
    },
  ): Promise<{ updated: number; matched: number; skipped: number; inserted: number; rows: NormalizedOddsRow[] }> {
    const { rows } = await this.fetchSportMainlines(sportKey, opts);
    if (!rows.length) return { updated: 0, matched: 0, skipped: 0, inserted: 0, rows: [] };

    // Build bulk upserts using the full schema fields
    const ops = rows.map((r) => ({
      updateOne: {
        filter: {
          sport: r.sport,
          eventId: r.eventId,
          bookmakerKey: r.bookmakerKey,
          market: r.market,
          selection: r.selection,
          team: r.team,
        },
        update: {
          $set: {
            // Full document fields from schema
            sport: r.sport,
            eventId: r.eventId,
            commenceTime: r.commenceTime,
            bookmakerKey: r.bookmakerKey,
            bookmakerTitle: r.bookmakerTitle,
            market: r.market,
            selection: r.selection,
            team: r.team,
            line: r.line ?? null,
            price: r.price,
            lastUpdate: r.lastUpdate,
          },
        },
        upsert: !!opts?.allowInsert,
      },
    }));

    const bulk = await this.oddsModel.bulkWrite(ops, { ordered: false });
    const modified = bulk.modifiedCount ?? 0;
    const matched = bulk.matchedCount ?? 0;
    const inserted = bulk.upsertedCount ?? 0;
    let skipped = rows.length - (matched + inserted);

    let manualInserted = 0;
    if (skipped > 0 && (opts?.allowInsert === true || (opts?.allowInsert === undefined && inserted === 0))) {
      const keys = rows.map(r => ({
        sport: r.sport,
        eventId: r.eventId,
        bookmakerKey: r.bookmakerKey,
        market: r.market,
        selection: r.selection,
        team: r.team,
      }));
      const existing = await this.oddsModel.find(
        { $or: keys },
        { sport: 1, eventId: 1, bookmakerKey: 1, market: 1, selection: 1, team: 1 }
      ).lean();

      const existingKeySet = new Set(
        existing.map(d => `${d.sport}|${d.eventId}|${d.bookmakerKey}|${d.market}|${d.selection}|${d.team}`)
      );

      const toInsert = rows
        .filter(r => !existingKeySet.has(`${r.sport}|${r.eventId}|${r.bookmakerKey}|${r.market}|${r.selection}|${r.team}`))
        .map(r => ({
          sport: r.sport,
          eventId: r.eventId,
          commenceTime: r.commenceTime,
          bookmakerKey: r.bookmakerKey,
          bookmakerTitle: r.bookmakerTitle,
          market: r.market,
          selection: r.selection,
          team: r.team,
          line: r.line ?? null,
          price: r.price,
          lastUpdate: r.lastUpdate,
        }));

      if (toInsert.length) {
        try {
          const res = await this.oddsModel.insertMany(toInsert, { ordered: false });
          manualInserted = res.length;
          skipped = Math.max(0, skipped - manualInserted);
        } catch (e) {
          this.log.warn(`InsertMany encountered duplicates or errors: ${String(e)}`);
        }
      }
    }

    return { updated: modified, matched, skipped, inserted: inserted + manualInserted, rows };
  }

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
      const usage = this.extractUsage(headers as Record<string, unknown>);
      return { events: data ?? [], usage };
    } catch (err: unknown) {
      if (typeof err === 'object' && err && 'response' in err) {
        const anyErr = err as { response?: { status?: number; data?: unknown } };
        const status = anyErr.response?.status;
        const body = anyErr.response?.data;
        this.log.error(`Odds API error ${status ?? ''}: ${JSON.stringify(body)}`);
      } else {
        this.log.error(`Unknown Odds API error: ${String(err)}`);
      }
      throw err;
    }
  }

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
                  selection: this.mapHomeAway(oc.name, ev.home_team),
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

  private mapHomeAway(name: string, home: string): 'home' | 'away' {
    const n = name.toLowerCase();
    return n === home.toLowerCase() || home.toLowerCase().includes(n)
      ? 'home'
      : 'away';
  }

  private mapOverUnder(name: string): 'over' | 'under' {
    const n = name.toLowerCase();
    return n.startsWith('o') ? 'over' : 'under';
  }

  private extractUsage(headers: Record<string, unknown>): OddsApiUsage {
    const getNum = (k: string): number | undefined => {
      const v = headers[k];
      if (v == null) return undefined;
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const used = getNum('x-requests-used') ?? getNum('x-requests-used-per-month');
    const remaining = getNum('x-requests-remaining');
    const lastRequestCost = getNum('x-requests-last');
    return {
      used,
      remaining,
      lastRequestCost,
    };
  }

  async getAllOdds(sport?: string) {
    const filter: Record<string, unknown> = {};
    if (sport) filter.sport = sport;
    return this.oddsModel
      .find(filter)
      .lean();
  }

  async getSportForEvent(eventId: string): Promise<SportKey | null> {
    const row = await this.oddsModel
      .findOne({ eventId })
      .select('sport')
      .lean()
      .exec();
    return row?.sport && isSportKey(row.sport) ? row.sport : null;
  }

  async refreshAllSports(): Promise<{ updated: number; inserted: number }> {
    const sports = [
      'americanfootball_nfl',
      'americanfootball_ncaaf',
      'basketball_nba',
      'basketball_ncaab',
    ];
    let updated = 0;
    let inserted = 0;
    for (const sportKey of sports) {
      try {
        const result = await this.fetchAndSaveSportMainlines(sportKey, {
          allowInsert: true,
        });
        updated += result.updated;
        inserted += result.inserted;
        this.log.log(
          `Odds refresh ${sportKey}: updated=${result.updated} inserted=${result.inserted}`,
        );
      } catch (err) {
        this.log.error(
          `Odds refresh failed for ${sportKey}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    return { updated, inserted };
  }

  /**
   * Pull the current DraftKings line for one event/selection and persist it.
   * Falls back to the last saved Mongo line if the live request fails.
   */
  async getDraftKingsLine(
    eventId: string,
    selection: string,
    market: 'spreads' | 'totals' = 'spreads',
  ): Promise<{ line: number } | null> {
    const selectionKey = selection.trim().toLowerCase();
    const stored = await this.oddsModel.findOne({ eventId }).lean();
    const sport = stored?.sport;
    if (sport) {
      try {
        const result = await this.fetchAndSaveSportMainlines(sport, {
          eventIds: eventId,
          allowInsert: true,
        });
        const live = result.rows.find((row) =>
          this.rowMatchesSelection(row, market, selectionKey),
        );
        if (live?.line != null) {
          return { line: live.line };
        }
      } catch (err) {
        this.log.warn(
          `Live DraftKings check failed for ${eventId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const fallback = await this.oddsModel
      .findOne({
        eventId,
        market,
        $or: [
          {
            team: {
              $regex: new RegExp(`^${this.escapeRegex(selection.trim())}$`, 'i'),
            },
          },
          {
            selection: {
              $regex: new RegExp(`^${this.escapeRegex(selection.trim())}$`, 'i'),
            },
          },
        ],
      })
      .lean();
    return fallback?.line != null ? { line: fallback.line } : null;
  }

  /** @deprecated Use getDraftKingsLine. Kept so existing callers still compile. */
  async getDraftKingsSpread(
    eventId: string,
    team: string,
  ): Promise<{ line: number } | null> {
    return this.getDraftKingsLine(eventId, team, 'spreads');
  }

  private rowMatchesSelection(
    row: NormalizedOddsRow,
    market: 'spreads' | 'totals',
    selectionKey: string,
  ): boolean {
    if (row.market !== market) return false;
    const team = (row.team || '').toLowerCase();
    const selection = (row.selection || '').toLowerCase();
    return team === selectionKey || selection === selectionKey;
  }

  private withTotalsMarket(markets: string): string {
    const parts = markets
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (!parts.includes('totals')) {
      parts.push('totals');
    }
    return parts.join(',');
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
