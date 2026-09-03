import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Pick, PickDocument } from './picks.schema';
import { OddsLatest, OddsLatestDocument } from '../odds/odds.schema';
import {
  formatAnnouncementLine,
  formatAnnouncementTotal,
} from './pick-announcement';
import { PickEmailQueueService } from './pick-email-queue.service';
import {
  getCurrentSeasonAndWeek,
} from '../utils/seasson-week.util';

const SPORT = 'americanfootball_ncaaf';
const TO = 'locksonlygame@yahoo.com';
const SUBJECT = 'LOCKSONLY';

/** Minimum consecutive graded losses to earn "Fade Watch". */
const FADE_WATCH_STREAK = 3;

/** Longest mascot phrases first so "Yellow Jackets" beats "Jackets". */
const MASCOT_SUFFIXES = [
  'Yellow Jackets',
  'Scarlet Knights',
  'Fighting Irish',
  'Rainbow Warriors',
  'Thundering Herd',
  'Golden Gophers',
  'Golden Eagles',
  'Golden Bears',
  'Blue Devils',
  'Red Raiders',
  'Demon Deacons',
  'Horned Frogs',
  'Nittany Lions',
  'Crimson Tide',
  'Tar Heels',
  'Blue Raiders',
  'Mean Green',
  'Seminoles',
  'Jayhawks',
  'Wildcats',
  'Bulldogs',
  'Tigers',
  'Rebels',
  'Broncos',
  'Ducks',
  'Dukes',
  'Bearcats',
  'Mustangs',
  'Cowboys',
  'Bruins',
  'Trojans',
  'Huskies',
  'Cougars',
  'Spartans',
  'Wolverines',
  'Buckeyes',
  'Sooners',
  'Longhorns',
  'Aggies',
  'Razorbacks',
  'Volunteers',
  'Gamecocks',
  'Mountaineers',
  'Panthers',
  'Cardinals',
  'Knights',
  'Pirates',
  'Owls',
  'Hawks',
  'Eagles',
  'Falcons',
  'Lions',
  'Bears',
  'Rams',
  'Bulls',
  'Miners',
  'Lobos',
  'Aztecs',
  'Wolfpack',
  'Sun Devils',
  'Utes',
  'Buffaloes',
  'Cyclones',
  'Hoosiers',
  'Boilermakers',
  'Hawkeyes',
  'Badgers',
  'Cornhuskers',
  'Commodores',
  'Hokies',
  'Cavaliers',
  'Terrapins',
  'Orange',
  'Gators',
  'Sooners',
  'Illini',
  'Midshipmen',
  'Black Knights',
  'Green Wave',
  'Ragin Cajuns',
  "Ragin' Cajuns",
];

function shortTeamName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  for (const suffix of MASCOT_SUFFIXES) {
    const tail = ` ${suffix.toLowerCase()}`;
    if (lower.endsWith(tail)) {
      return trimmed.slice(0, trimmed.length - suffix.length - 1).trim();
    }
  }
  return trimmed;
}

/** Slot labels used in the dedup pickId. */
export type SummarySlot = 'thu-3pm' | 'fri-8pm' | 'sat-11am';

type PickRow = {
  displayName: string;
  team: string;
  market: 'spreads' | 'totals';
  line: number | null;
  loy: boolean;
  awayTeam: string | null;
  homeTeam: string | null;
  status: string;
  season: number;
  week: number;
};

@Injectable()
export class SummaryEmailService {
  private readonly log = new Logger(SummaryEmailService.name);

  constructor(
    @InjectModel(Pick.name)
    private readonly pickModel: Model<PickDocument>,
    @InjectModel(OddsLatest.name)
    private readonly oddsModel: Model<OddsLatestDocument>,
    private readonly queue: PickEmailQueueService,
  ) {}

  /**
   * Build and send a snapshot for the current NCAAF week.
   * Deduplicates per season/week/slot so scheduled sends fire at most once.
   * Pass `{ force: true }` from the admin button to resend the same slot.
   */
  async sendSnapshot(
    slot: SummarySlot,
    options?: { force?: boolean },
  ): Promise<void> {
    const { season, week } = getCurrentSeasonAndWeek(
      new Date(),
      undefined,
      SPORT,
    );

    const picks = await this.loadCurrentWeekPicks(season, week);
    if (!picks.length) {
      this.log.log(
        `Summary email (${slot}) skipped — no picks for NCAAF S${season} W${week}`,
      );
      return;
    }

    const allPicks = await this.loadSeasonPicks(season);
    const text = this.buildBody(picks, allPicks, week);

    // Stable synthetic ObjectId: hash season+week+slot into deterministic bytes
    const pickId = this.slotPickId(season, week, slot);

    try {
      if (options?.force) {
        await this.queue.reset(pickId);
      }
      await this.queue.enqueue({ pickId, to: TO, subject: SUBJECT, text });
      await this.queue.drainDue();
      this.log.log(`Summary email queued for slot ${slot} S${season} W${week}`);
    } catch (err) {
      this.log.error(
        `Summary email failed for slot ${slot}`,
        err instanceof Error ? err.stack ?? err.message : String(err),
      );
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async loadCurrentWeekPicks(
    season: number,
    week: number,
  ): Promise<PickRow[]> {
    const raw = await this.pickModel
      .find({ sportKey: SPORT, season, week })
      .populate('userId', 'displayName')
      .select('userId eventId team market line supercharged status')
      .lean()
      .exec();

    const eventIds = [...new Set(raw.map((p) => p.eventId))];
    const matchupMap = await this.loadMatchups(eventIds);

    return raw.map((p) => {
      const user = p.userId as unknown as { displayName?: string } | null;
      const market: 'spreads' | 'totals' =
        p.market === 'totals' ? 'totals' : 'spreads';
      const matchup = matchupMap.get(p.eventId) ?? null;
      return {
        displayName: user?.displayName?.trim() || 'Unknown',
        team: p.team,
        market,
        line: p.line ?? null,
        loy: !!p.supercharged,
        awayTeam: matchup?.awayTeam ?? null,
        homeTeam: matchup?.homeTeam ?? null,
        status: p.status ?? 'pending',
        season,
        week,
      };
    });
  }

  /**
   * Load all graded picks for the season — used for streak calculation.
   * We do NOT need names here, just userId + status chains.
   */
  private async loadSeasonPicks(
    season: number,
  ): Promise<Array<{ displayName: string; statuses: string[] }>> {
    const raw = await this.pickModel
      .find({ sportKey: SPORT, season })
      .populate('userId', 'displayName')
      .select('userId week status')
      .sort({ week: 1 })
      .lean()
      .exec();

    const byUser = new Map<
      string,
      { displayName: string; statuses: string[] }
    >();
    for (const p of raw) {
      const user = p.userId as unknown as {
        _id?: { toString(): string };
        displayName?: string;
      } | null;
      const uid = user?._id?.toString() ?? String(p.userId);
      const name = user?.displayName?.trim() || 'Unknown';
      const entry = byUser.get(uid) ?? { displayName: name, statuses: [] };
      // Only count graded results for streaks
      if (p.status === 'won' || p.status === 'lost' || p.status === 'void') {
        entry.statuses.push(p.status);
      }
      byUser.set(uid, entry);
    }
    return [...byUser.values()];
  }

  private async loadMatchups(
    eventIds: string[],
  ): Promise<Map<string, { awayTeam: string; homeTeam: string }>> {
    const map = new Map<string, { awayTeam: string; homeTeam: string }>();
    if (!eventIds.length) return map;
    const rows = await this.oddsModel
      .find({ eventId: { $in: eventIds }, market: 'spreads' })
      .select('eventId selection team')
      .lean()
      .exec();
    for (const row of rows) {
      const cur = map.get(row.eventId) ?? { awayTeam: '', homeTeam: '' };
      if (row.selection === 'away' && row.team) cur.awayTeam = row.team;
      if (row.selection === 'home' && row.team) cur.homeTeam = row.team;
      map.set(row.eventId, cur);
    }
    return map;
  }

  // ─── Body builder ───────────────────────────────────────────────────────────

  private buildBody(
    picks: PickRow[],
    allPicks: Array<{ displayName: string; statuses: string[] }>,
    week: number,
  ): string {
    const parts: string[] = [
      'LOCKS ONLY',
      `NCAAF WEEK ${week}`,
    ];

    const highlights = this.buildHighlights(picks, allPicks);
    if (highlights.length) {
      parts.push('', 'HIGHLIGHTS:', '', highlights.join('\n\n'));
    }

    parts.push('', 'PICKS:', this.buildPickList(picks), '', this.reminderLine(picks.length));
    return parts.join('\n');
  }

  private buildHighlights(
    picks: PickRow[],
    allPicks: Array<{ displayName: string; statuses: string[] }>,
  ): string[] {
    const out: string[] = [];

    // Most-picked team among spread picks
    const teamCounts = new Map<string, number>();
    for (const p of picks) {
      if (p.market === 'spreads') {
        teamCounts.set(p.team, (teamCounts.get(p.team) ?? 0) + 1);
      }
    }
    if (teamCounts.size) {
      const [topTeam, topCount] = [...teamCounts.entries()].sort(
        (a, b) => b[1] - a[1],
      )[0];
      if (topCount >= 2) {
        out.push(
          `${shortTeamName(topTeam)} is the crowd favorite - ${topCount} locks already. Everyone is a believer.`,
        );
      }
    }

    // Lone wolf: a team that exactly one player picked (spread)
    const loneWolves: string[] = [];
    for (const [team, count] of teamCounts.entries()) {
      if (count === 1) {
        const picker = picks.find(
          (p) => p.team === team && p.market === 'spreads',
        )?.displayName;
        if (picker) loneWolves.push(picker);
      }
    }
    if (loneWolves.length === 1) {
      out.push(`${loneWolves[0]} is the lone wolf this week.`);
    } else if (loneWolves.length >= 2) {
      out.push(`Multiple lone wolves this week: ${loneWolves.join(', ')}`);
    }

    // Fade Watch: players with FADE_WATCH_STREAK+ consecutive losses in season
    const fadeNames: string[] = [];
    for (const player of allPicks) {
      const recent = [...player.statuses].slice(-FADE_WATCH_STREAK);
      if (
        recent.length >= FADE_WATCH_STREAK &&
        recent.every((s) => s === 'lost')
      ) {
        fadeNames.push(player.displayName);
      }
    }
    if (fadeNames.length === 1) {
      out.push(
        `${fadeNames[0]} is on the Fade Watch list. Check what they picked and consider the other side.`,
      );
    } else if (fadeNames.length >= 2) {
      out.push(
        `Fade Watch alert: ${fadeNames.join(' and ')} are both ice cold. Their picks are officially under review.`,
      );
    }

    // Cap at 3 highlights
    return out.slice(0, 3);
  }

  /** One pick per line so iMessage / Mail automations keep the breaks. */
  private buildPickList(picks: PickRow[]): string {
    const sorted = [...picks].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
    return sorted
      .map((p) => {
        const loy = p.loy ? ' LOY🔥' : '';
        return `${p.displayName}: ${this.pickLabel(p)}${loy}`;
      })
      .join('\n');
  }

  private pickLabel(p: PickRow): string {
    if (p.market === 'totals') {
      const side = p.team.toLowerCase() === 'under' ? 'u' : 'o';
      const total = formatAnnouncementTotal(p.line);
      const away = shortTeamName(p.awayTeam?.trim() ?? '');
      const home = shortTeamName(p.homeTeam?.trim() ?? '');
      const matchup = away && home ? `${away}/${home}` : '';
      return matchup
        ? `${matchup} ${side}${total}`
        : `${side === 'u' ? 'Under' : 'Over'} ${total}`;
    }
    const line = formatAnnouncementLine(p.line);
    return `${shortTeamName(p.team)} ${line}`.trim();
  }

  private reminderLine(pickCount: number): string {
    const reminders = [
      `Locks are live — if your name isn't on this list, get it together. ⏳`,
      `Don't see your name up there? Get your pick in before the window closes. 🔒`,
      `Picks are dropping — don't sleep on it. Clock's ticking. 🏈`,
      `The board is filling up. No excuses, get your locks in boys. 💪`,
      `Still missing some names. Don't be the last one in. Let's go. 🔥`,
    ];
    // Vary by pick count so Thursday / Friday / Saturday each feel different
    return reminders[pickCount % reminders.length];
  }

  /**
   * Deterministic ObjectId for a given season/week/slot so the outbox unique
   * index prevents duplicate sends even if the cron fires twice.
   * Format: first 4 bytes = season (big-endian), next 3 = week, rest = slot hash.
   */
  private slotPickId(
    season: number,
    week: number,
    slot: SummarySlot,
  ): Types.ObjectId {
    const slotNum =
      slot === 'thu-3pm' ? 1 : slot === 'fri-8pm' ? 2 : 3;
    // Build a 12-byte hex string that is stable per season/week/slot
    const hex = [
      season.toString(16).padStart(8, '0'),
      week.toString(16).padStart(4, '0'),
      slotNum.toString(16).padStart(4, '0'),
      'deadbeef', // fixed padding
    ].join('').slice(0, 24);
    return new Types.ObjectId(hex);
  }
}
