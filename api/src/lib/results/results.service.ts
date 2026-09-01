import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios, { AxiosInstance } from 'axios';
import { GameResult, GameResultDocument } from './game-result.schema';
import { Pick, PickDocument } from '../picks/picks.schema';
import { getCurrentSeasonAndWeek } from '../utils/seasson-week.util';
import {
  applyGradedPick,
  compareStandings,
  emptyStanding,
  resolvePickMarket as resolveMarket,
} from './standings.util';

type OddsScoreRow = {
  name: string;
  score: string;
};

type OddsScoreEvent = {
  id: string;
  sport_key: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: OddsScoreRow[] | null;
  last_update: string | null;
};

export type StandingRow = {
  userId: string;
  displayName: string;
  wins: number;
  losses: number;
  voids: number;
  /** Net from LOY picks only (+1 win bonus, −1 loss, −1 push). Total points = wins + this. */
  superchargePoints: number;
  points: number;
};

const SPORT_KEYS = [
  'americanfootball_nfl',
  'americanfootball_ncaaf',
  'basketball_nba',
  'basketball_ncaab',
] as const;

@Injectable()
export class ResultsService implements OnModuleInit {
  private readonly log = new Logger(ResultsService.name);
  private readonly http: AxiosInstance;
  private readonly apiKey: string;

  constructor(
    @InjectModel(GameResult.name)
    private readonly gameResultModel: Model<GameResultDocument>,
    @InjectModel(Pick.name)
    private readonly pickModel: Model<PickDocument>,
  ) {
    this.apiKey = process.env.ODDS_API_KEY || '';
    if (!this.apiKey) {
      this.log.warn('ODDS_API_KEY is not set. Score sync will fail.');
    }
    this.http = axios.create({
      baseURL: 'https://api.the-odds-api.com/v4',
      timeout: 15_000,
      headers: { 'User-Agent': 'mongo-espn-line-app/1.0 (NestJS)' },
    });
  }

  async onModuleInit() {
    try {
      await this.backfillMargins();
    } catch (err) {
      this.log.error(
        'Failed to backfill pick margins',
        err instanceof Error ? err.stack ?? err.message : String(err),
      );
    }
  }

  async fetchAndSaveScores(sportKey: string): Promise<{ upserted: number }> {
    if (!this.apiKey) {
      this.log.warn(`Skipping scores for ${sportKey}: missing ODDS_API_KEY`);
      return { upserted: 0 };
    }

    const { data } = await this.http.get<OddsScoreEvent[]>(
      `/sports/${sportKey}/scores`,
      {
        params: {
          apiKey: this.apiKey,
          daysFrom: 3,
          dateFormat: 'iso',
        },
      },
    );

    const completed = (data ?? []).filter(
      (e) => e.completed && Array.isArray(e.scores) && e.scores.length >= 2,
    );

    if (!completed.length) {
      return { upserted: 0 };
    }

    const ops = completed.map((e) => {
      const homeScore = Number(
        e.scores!.find((s) => s.name === e.home_team)?.score,
      );
      const awayScore = Number(
        e.scores!.find((s) => s.name === e.away_team)?.score,
      );
      if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
        return null;
      }
      return {
        updateOne: {
          filter: { eventId: e.id },
          update: {
            $set: {
              eventId: e.id,
              sportKey: e.sport_key || sportKey,
              commenceTime: new Date(e.commence_time),
              homeTeam: e.home_team,
              awayTeam: e.away_team,
              homeScore,
              awayScore,
              completed: true,
              lastUpdate: e.last_update ? new Date(e.last_update) : null,
            },
          },
          upsert: true,
        },
      };
    });

    const bulk = ops.filter((op): op is NonNullable<typeof op> => !!op);
    if (!bulk.length) return { upserted: 0 };

    const result = await this.gameResultModel.bulkWrite(bulk, {
      ordered: false,
    });
    const upserted =
      (result.upsertedCount ?? 0) + (result.modifiedCount ?? 0);
    this.log.log(
      `Saved scores for ${sportKey}: ${upserted} upserted/updated (${bulk.length} completed)`,
    );
    return { upserted };
  }

  gradeAts(
    pickedTeam: string,
    line: number | null,
    homeTeam: string,
    awayTeam: string,
    homeScore: number,
    awayScore: number,
  ): { status: 'won' | 'lost' | 'void'; margin: number } | null {
    const isHome = pickedTeam === homeTeam;
    const isAway = pickedTeam === awayTeam;
    if (!isHome && !isAway) {
      return null;
    }

    const pickedScore = isHome ? homeScore : awayScore;
    const opponentScore = isHome ? awayScore : homeScore;
    const spread = line ?? 0;
    const margin = pickedScore - opponentScore + spread;

    if (margin > 0) return { status: 'won', margin };
    if (margin < 0) return { status: 'lost', margin };
    return { status: 'void', margin: 0 };
  }

  gradeTotals(
    selection: string,
    line: number | null,
    homeScore: number,
    awayScore: number,
  ): { status: 'won' | 'lost' | 'void'; margin: number } | null {
    const side = selection.trim().toLowerCase();
    if (side !== 'over' && side !== 'under') {
      return null;
    }
    if (line == null || Number.isNaN(Number(line))) {
      return null;
    }
    const finalTotal = homeScore + awayScore;
    const totalLine = Number(line);
    const diff = finalTotal - totalLine;
    if (diff === 0) return { status: 'void', margin: 0 };
    if (side === 'over') {
      return { status: diff > 0 ? 'won' : 'lost', margin: diff };
    }
    return { status: diff < 0 ? 'won' : 'lost', margin: -diff };
  }

  async gradePendingPicks(): Promise<{ graded: number; skipped: number }> {
    const pending = await this.pickModel.find({ status: 'pending' }).lean();
    if (!pending.length) {
      return { graded: 0, skipped: 0 };
    }

    const eventIds = [...new Set(pending.map((p) => p.eventId))];
    const results = await this.gameResultModel
      .find({ eventId: { $in: eventIds }, completed: true })
      .lean();
    const byEvent = new Map(results.map((r) => [r.eventId, r]));

    let graded = 0;
    let skipped = 0;

    for (const pick of pending) {
      const game = byEvent.get(pick.eventId);
      if (!game) {
        skipped += 1;
        continue;
      }

      const outcome = this.gradeStoredPick(pick, game);
      if (!outcome) {
        this.log.warn(
          `Could not grade pick "${pick.team}" (${pick.market ?? 'spreads'}) for game ${pick.eventId}`,
        );
        skipped += 1;
        continue;
      }

      await this.pickModel.updateOne(
        { _id: pick._id },
        { $set: { status: outcome.status, margin: outcome.margin } },
      );
      graded += 1;
    }

    this.log.log(`Graded ${graded} picks (${skipped} still pending/skipped)`);
    return { graded, skipped };
  }

  async syncAllSports(): Promise<{
    sports: Record<string, { upserted: number }>;
    graded: number;
    skipped: number;
  }> {
    const sports: Record<string, { upserted: number }> = {};
    for (const sportKey of SPORT_KEYS) {
      try {
        sports[sportKey] = await this.fetchAndSaveScores(sportKey);
      } catch (err) {
        this.log.error(
          `Failed to sync scores for ${sportKey}`,
          err instanceof Error ? err.stack : String(err),
        );
        sports[sportKey] = { upserted: 0 };
      }
    }
    const { graded, skipped } = await this.gradePendingPicks();
    return { sports, graded, skipped };
  }

  async getStandings(season?: number, sportKey?: string): Promise<StandingRow[]> {
    const resolvedSeason = season ?? getCurrentSeasonAndWeek().season;
    const filter: Record<string, unknown> = { season: resolvedSeason };
    if (sportKey) filter.sportKey = sportKey;

    const rows = await this.pickModel
      .find(filter)
      .populate('userId', 'displayName')
      .select('userId status supercharged')
      .lean();

    const byUser = new Map<
      string,
      {
        displayName: string;
        wins: number;
        losses: number;
        voids: number;
        superchargePoints: number;
        points: number;
      }
    >();

    for (const pick of rows) {
      const user = pick.userId as unknown as {
        _id?: { toString(): string };
        displayName?: string;
      } | null;
      if (!user?._id) continue;
      const userId = user._id.toString();
      const entry = byUser.get(userId) ?? emptyStanding(user.displayName || 'Unknown');
      applyGradedPick(entry, pick.status, !!pick.supercharged);
      byUser.set(userId, entry);
    }

    return [...byUser.entries()]
      .map(([userId, e]) => ({
        userId,
        displayName: e.displayName,
        wins: e.wins,
        losses: e.losses,
        voids: e.voids,
        superchargePoints: e.superchargePoints,
        points: e.points,
      }))
      .sort(compareStandings);
  }

  private resolvePickMarket(
    market: string | undefined,
    team: string,
  ): 'spreads' | 'totals' {
    return resolveMarket(market, team);
  }

  private gradeStoredPick(
    pick: {
      market?: 'spreads' | 'totals';
      team: string;
      line: number | null;
    },
    game: {
      homeTeam: string;
      awayTeam: string;
      homeScore: number;
      awayScore: number;
    },
  ): { status: 'won' | 'lost' | 'void'; margin: number } | null {
    const market = this.resolvePickMarket(pick.market, pick.team);
    return market === 'totals'
      ? this.gradeTotals(pick.team, pick.line, game.homeScore, game.awayScore)
      : this.gradeAts(
          pick.team,
          pick.line,
          game.homeTeam,
          game.awayTeam,
          game.homeScore,
          game.awayScore,
        );
  }

  private async backfillMargins(): Promise<void> {
    const missing = await this.pickModel
      .find({
        status: { $in: ['won', 'lost', 'void'] },
        $or: [{ margin: { $exists: false } }, { margin: null }],
      })
      .select('_id eventId team market line')
      .lean()
      .exec();
    if (!missing.length) return;

    const eventIds = [...new Set(missing.map((pick) => pick.eventId))];
    const games = await this.gameResultModel
      .find({ eventId: { $in: eventIds }, completed: true })
      .lean()
      .exec();
    const byEvent = new Map(games.map((game) => [game.eventId, game]));

    const ops: {
      updateOne: {
        filter: { _id: unknown };
        update: { $set: { margin: number } };
      };
    }[] = [];
    for (const pick of missing) {
      const game = byEvent.get(pick.eventId);
      if (!game) continue;
      const outcome = this.gradeStoredPick(pick, game);
      if (!outcome) continue;
      ops.push({
        updateOne: {
          filter: { _id: pick._id },
          update: { $set: { margin: outcome.margin } },
        },
      });
    }
    if (!ops.length) return;
    await this.pickModel.bulkWrite(ops, { ordered: false });
    this.log.log(`Backfilled margin on ${ops.length} graded picks`);
  }
}
