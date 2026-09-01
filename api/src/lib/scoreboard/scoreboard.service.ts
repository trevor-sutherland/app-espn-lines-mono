import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/users.schema';
import { Pick, PickDocument } from '../picks/picks.schema';
import { OddsLatest, OddsLatestDocument } from '../odds/odds.schema';
import { getCurrentSeasonAndWeek } from '../utils/seasson-week.util';
import {
  applyGradedPick,
  compareStandings,
  emptyStanding,
  formatRecord,
  isGradedStatus,
  pointsForPick,
  resolvePickMarket,
  type StandingAcc,
} from '../results/standings.util';
import {
  formatPickAnnouncement,
  formatPickSelectionLabel,
} from '../picks/pick-announcement';
import { resolveUserSports, type SportKey } from '../utils/sports';

type LeanPick = {
  _id: unknown;
  userId:
    | { _id?: { toString(): string }; displayName?: string }
    | string;
  eventId: string;
  week: number;
  season: number;
  market?: 'spreads' | 'totals';
  team: string;
  line: number | null;
  status: string;
  supercharged?: boolean;
  lockedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

export type ScoreboardRow = {
  userId: string;
  displayName: string;
  rank: number;
  rankDelta: number | null;
  points: number;
  wins: number;
  losses: number;
  voids: number;
  record: string;
  currentWeekPick: string | null;
  currentWeekLoy: boolean;
  loneWolf: boolean;
  streak: string;
  loyUsed: boolean;
  loyWeek: number | null;
  weeklyPoints: number;
};

export type TopPickRow = {
  label: string;
  count: number;
  pct: number;
};

export type WeeklyLeader = {
  userId: string;
  displayName: string;
  points: number;
};

export type ActivityItem = {
  at: string;
  text: string;
};

export type PlayerHistoryPick = {
  week: number;
  label: string;
  loy: boolean;
  status: string;
  points: number;
};

@Injectable()
export class ScoreboardService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Pick.name)
    private readonly pickModel: Model<PickDocument>,
    @InjectModel(OddsLatest.name)
    private readonly oddsModel: Model<OddsLatestDocument>,
  ) {}

  async getScoreboard(seasonRaw?: number, sportKey?: SportKey) {
    const current = getCurrentSeasonAndWeek();
    const season = Number.isFinite(seasonRaw) ? Number(seasonRaw) : current.season;
    const week = current.week;
    if (!sportKey) {
      throw new NotFoundException('A valid sport is required');
    }

    const [users, picks] = await Promise.all([
      this.userModel
        .find({ approved: true, active: { $ne: false } })
        .select('displayName sports')
        .lean()
        .exec(),
      this.pickModel
        .find({ season, sportKey })
        .populate('userId', 'displayName')
        .lean()
        .exec(),
    ]);

    const leanPicks = picks as unknown as LeanPick[];
    const matchups = await this.loadMatchups(
      leanPicks.filter((p) => p.week === week).map((p) => p.eventId),
    );

    const picksByUser = new Map<string, LeanPick[]>();
    for (const pick of leanPicks) {
      const userId = this.userIdOf(pick);
      if (!userId) continue;
      const list = picksByUser.get(userId) ?? [];
      list.push(pick);
      picksByUser.set(userId, list);
    }

    const boardUsers = users
      .filter((user) => resolveUserSports(user.sports).includes(sportKey))
      .map((user) => ({
        userId: String(user._id),
        displayName: user.displayName || 'Unknown',
      }));
    for (const [userId, list] of picksByUser) {
      if (boardUsers.some((u) => u.userId === userId)) continue;
      const populated = list[0]?.userId;
      const displayName =
        populated && typeof populated === 'object'
          ? populated.displayName || 'Unknown'
          : 'Unknown';
      boardUsers.push({ userId, displayName });
    }

    const seasonAcc = new Map<string, StandingAcc>();
    const priorAcc = new Map<string, StandingAcc>();
    for (const user of boardUsers) {
      seasonAcc.set(user.userId, emptyStanding(user.displayName));
      priorAcc.set(user.userId, emptyStanding(user.displayName));
    }
    for (const pick of leanPicks) {
      const userId = this.userIdOf(pick);
      if (!userId) continue;
      const seasonEntry = seasonAcc.get(userId);
      if (seasonEntry) {
        applyGradedPick(seasonEntry, pick.status, !!pick.supercharged);
      }
      if (pick.week < week) {
        const priorEntry = priorAcc.get(userId);
        if (priorEntry) {
          applyGradedPick(priorEntry, pick.status, !!pick.supercharged);
        }
      }
    }

    const ranked = [...seasonAcc.entries()]
      .map(([userId, acc]) => ({ userId, ...acc }))
      .sort(compareStandings);
    const priorRanked = [...priorAcc.entries()]
      .map(([userId, acc]) => ({ userId, ...acc }))
      .sort(compareStandings);
    const priorRank = new Map<string, number>();
    priorRanked.forEach((row, i) => priorRank.set(row.userId, i + 1));

    const weekPicks = leanPicks.filter((p) => p.week === week);
    const submittedCount = weekPicks.length;
    const pickGroups = new Map<string, { count: number; label: string }>();
    for (const pick of weekPicks) {
      const key = this.selectionKey(pick);
      const label =
        this.selectionLabel(pick, matchups, false) ||
        `${pick.team} ${pick.line ?? ''}`.trim();
      const group = pickGroups.get(key) ?? { count: 0, label };
      group.count += 1;
      pickGroups.set(key, group);
    }
    const loneWolfKeys = new Set<string>();
    if (submittedCount > 1) {
      for (const [key, group] of pickGroups) {
        if (group.count === 1) loneWolfKeys.add(key);
      }
    }

    const standings: ScoreboardRow[] = ranked.map((row, index) => {
      const userPicks = picksByUser.get(row.userId) ?? [];
      const weekPick = userPicks.find((p) => p.week === week) ?? null;
      const loyPick = userPicks.find((p) => p.supercharged);
      const prev = priorRank.get(row.userId) ?? null;
      const rank = index + 1;
      const hasPriorGraded = (priorAcc.get(row.userId)?.wins ?? 0) +
        (priorAcc.get(row.userId)?.losses ?? 0) +
        (priorAcc.get(row.userId)?.voids ?? 0) >
        0;
      return {
        userId: row.userId,
        displayName: row.displayName,
        rank,
        rankDelta:
          hasPriorGraded && prev != null ? prev - rank : null,
        points: row.points,
        wins: row.wins,
        losses: row.losses,
        voids: row.voids,
        record: formatRecord(row.wins, row.losses, row.voids),
        currentWeekPick: weekPick
          ? this.selectionLabel(weekPick, matchups, true)
          : null,
        currentWeekLoy: !!weekPick?.supercharged,
        loneWolf: weekPick ? loneWolfKeys.has(this.selectionKey(weekPick)) : false,
        streak: this.formatStreak(this.currentStreak(userPicks)),
        loyUsed: !!loyPick,
        loyWeek: loyPick?.week ?? null,
        weeklyPoints: weekPick
          ? pointsForPick(weekPick.status, !!weekPick.supercharged)
          : 0,
      };
    });

    const topPicks: TopPickRow[] = [...pickGroups.values()]
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 3)
      .map((group) => ({
        label: group.label,
        count: group.count,
        pct: submittedCount ? Math.round((group.count / submittedCount) * 100) : 0,
      }));

    const weeklyLeaders: WeeklyLeader[] = standings
      .filter((row) => {
        const weekPick = (picksByUser.get(row.userId) ?? []).find(
          (p) => p.week === week,
        );
        return weekPick ? isGradedStatus(weekPick.status) : false;
      })
      .sort((a, b) => b.weeklyPoints - a.weeklyPoints || a.displayName.localeCompare(b.displayName))
      .slice(0, 5)
      .map((row) => ({
        userId: row.userId,
        displayName: row.displayName,
        points: row.weeklyPoints,
      }));

    const activity = this.buildActivity(
      leanPicks,
      standings,
      matchups,
    );

    return {
      season,
      week,
      sportKey,
      rangeLabel: current.rangeLabel,
      standings,
      topPicks,
      weeklyLeaders,
      activity,
      submittedCount,
    };
  }

  async getPlayer(userId: string, seasonRaw?: number, sportKey?: SportKey) {
    const current = getCurrentSeasonAndWeek();
    const season = Number.isFinite(seasonRaw) ? Number(seasonRaw) : current.season;
    if (!sportKey) {
      throw new NotFoundException('A valid sport is required');
    }
    const user = await this.userModel
      .findById(userId)
      .select('displayName approved active')
      .lean()
      .exec();
    if (!user) throw new NotFoundException('Player not found');

    const picks = (await this.pickModel
      .find({ season, userId, sportKey })
      .lean()
      .exec()) as unknown as LeanPick[];
    const matchups = await this.loadMatchups(picks.map((p) => p.eventId));

    const acc = emptyStanding(user.displayName || 'Unknown');
    const spread = emptyStanding('');
    const totals = emptyStanding('');
    const loy = emptyStanding('');
    let loyWeek: number | null = null;

    for (const pick of picks) {
      applyGradedPick(acc, pick.status, !!pick.supercharged);
      const market = resolvePickMarket(pick.market, pick.team);
      if (market === 'totals') {
        applyGradedPick(totals, pick.status, false);
      } else {
        applyGradedPick(spread, pick.status, false);
      }
      if (pick.supercharged) {
        loyWeek = pick.week;
        applyGradedPick(loy, pick.status, false);
      }
    }

    const history: PlayerHistoryPick[] = [...picks]
      .sort((a, b) => a.week - b.week)
      .map((pick) => ({
        week: pick.week,
        label: this.selectionLabel(pick, matchups, true) || pick.team,
        loy: !!pick.supercharged,
        status: pick.status,
        points: pointsForPick(pick.status, !!pick.supercharged),
      }));

    const currentStreak = this.currentStreak(picks);
    const bestWin = this.bestWinStreak(picks);

    return {
      userId: String(user._id),
      displayName: user.displayName || 'Unknown',
      season,
      week: current.week,
      sportKey,
      points: acc.points,
      record: formatRecord(acc.wins, acc.losses, acc.voids),
      wins: acc.wins,
      losses: acc.losses,
      voids: acc.voids,
      streak: this.formatStreak(currentStreak),
      bestWinStreak: bestWin > 0 ? `W${bestWin}` : '—',
      spreadRecord: formatRecord(spread.wins, spread.losses, spread.voids),
      totalsRecord: formatRecord(totals.wins, totals.losses, totals.voids),
      loyUsed: loyWeek != null,
      loyWeek,
      loyRecord:
        loyWeek == null
          ? null
          : formatRecord(loy.wins, loy.losses, loy.voids),
      history,
    };
  }

  private userIdOf(pick: LeanPick): string | null {
    const ref = pick.userId;
    if (ref && typeof ref === 'object' && ref._id) return ref._id.toString();
    if (typeof ref === 'string') return ref;
    return null;
  }

  private displayNameOf(pick: LeanPick): string {
    const ref = pick.userId;
    if (ref && typeof ref === 'object') return ref.displayName || 'Unknown';
    return 'Unknown';
  }

  private selectionKey(pick: LeanPick): string {
    const market = resolvePickMarket(pick.market, pick.team);
    return `${market}|${pick.team.trim().toLowerCase()}|${pick.line ?? ''}|${pick.eventId}`;
  }

  private selectionLabel(
    pick: LeanPick,
    matchups: Map<string, { awayTeam: string; homeTeam: string }>,
    includeLoy: boolean,
  ): string | null {
    const market = resolvePickMarket(pick.market, pick.team);
    const matchup = matchups.get(pick.eventId);
    return formatPickSelectionLabel({
      market,
      team: pick.team,
      line: pick.line,
      loy: includeLoy && !!pick.supercharged,
      awayTeam: matchup?.awayTeam,
      homeTeam: matchup?.homeTeam,
    });
  }

  private async loadMatchups(
    eventIds: string[],
  ): Promise<Map<string, { awayTeam: string; homeTeam: string }>> {
    const ids = [...new Set(eventIds.filter(Boolean))];
    const map = new Map<string, { awayTeam: string; homeTeam: string }>();
    if (!ids.length) return map;
    const rows = await this.oddsModel
      .find({ eventId: { $in: ids }, market: 'spreads' })
      .select('eventId selection team')
      .lean()
      .exec();
    for (const row of rows) {
      const current = map.get(row.eventId) ?? { awayTeam: '', homeTeam: '' };
      if (row.selection === 'away' && row.team) current.awayTeam = row.team;
      if (row.selection === 'home' && row.team) current.homeTeam = row.team;
      map.set(row.eventId, current);
    }
    return map;
  }

  /**
   * Push (void) does not increment W/L and does not break the streak.
   * No prior app convention existed; this is the dashboard rule.
   */
  private currentStreak(picks: LeanPick[]): { kind: 'W' | 'L' | null; count: number } {
    const graded = [...picks]
      .filter((p) => isGradedStatus(p.status))
      .sort((a, b) => b.week - a.week);
    let kind: 'W' | 'L' | null = null;
    let count = 0;
    for (const pick of graded) {
      if (pick.status === 'void') continue;
      const next: 'W' | 'L' = pick.status === 'won' ? 'W' : 'L';
      if (kind == null) kind = next;
      if (next !== kind) break;
      count += 1;
    }
    return { kind, count };
  }

  private bestWinStreak(picks: LeanPick[]): number {
    const graded = [...picks]
      .filter((p) => isGradedStatus(p.status))
      .sort((a, b) => a.week - b.week);
    let best = 0;
    let current = 0;
    for (const pick of graded) {
      if (pick.status === 'void') continue;
      if (pick.status === 'won') {
        current += 1;
        if (current > best) best = current;
      } else {
        current = 0;
      }
    }
    return best;
  }

  private formatStreak(streak: { kind: 'W' | 'L' | null; count: number }): string {
    if (!streak.kind || streak.count < 1) return '—';
    if (streak.kind === 'W') {
      return streak.count >= 3 ? `W${streak.count} 🔥` : `W${streak.count}`;
    }
    return streak.count >= 3 ? `L${streak.count} 🧊` : `L${streak.count}`;
  }

  private buildActivity(
    picks: LeanPick[],
    standings: ScoreboardRow[],
    matchups: Map<string, { awayTeam: string; homeTeam: string }>,
  ): ActivityItem[] {
    const items: ActivityItem[] = [];

    for (const pick of picks) {
      const name = this.displayNameOf(pick);
      const market = resolvePickMarket(pick.market, pick.team);
      const matchup = matchups.get(pick.eventId);
      const announcement = formatPickAnnouncement({
        displayName: name,
        market,
        team: pick.team,
        line: pick.line,
        loy: !!pick.supercharged,
        awayTeam: matchup?.awayTeam,
        homeTeam: matchup?.homeTeam,
      });
      const lockedAt = pick.lockedAt || pick.createdAt;
      if (announcement && lockedAt) {
        items.push({
          at: new Date(lockedAt).toISOString(),
          text: announcement,
        });
      }
      const label =
        this.selectionLabel(pick, matchups, true) || pick.team;
      const gradedAt = pick.updatedAt || pick.lockedAt;
      if (pick.status === 'won' && gradedAt) {
        items.push({
          at: new Date(gradedAt).toISOString(),
          text: `✅ ${name}'s ${label} won`,
        });
      } else if (pick.status === 'lost' && gradedAt) {
        items.push({
          at: new Date(gradedAt).toISOString(),
          text: `❌ ${name}'s ${label} lost`,
        });
      } else if (pick.status === 'void' && gradedAt) {
        items.push({
          at: new Date(gradedAt).toISOString(),
          text: `➖ ${name}'s ${label} pushed`,
        });
      }
    }

    for (const row of standings) {
      if (row.streak.startsWith('W') && row.streak.includes('🔥')) {
        items.push({
          at: new Date().toISOString(),
          text: `🔥 ${row.displayName} has won ${row.streak.replace(/[^\d]/g, '')} straight`,
        });
      }
      if (row.streak.startsWith('L') && row.streak.includes('🧊')) {
        items.push({
          at: new Date().toISOString(),
          text: `🧊 ${row.displayName} has lost ${row.streak.replace(/[^\d]/g, '')} straight`,
        });
      }
    }

    return items
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 25);
  }
}
