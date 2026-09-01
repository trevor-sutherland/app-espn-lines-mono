import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/users.schema';
import { OddsLatest, OddsLatestDocument } from '../odds/odds.schema';
import { PickDocument } from './picks.schema';
import { formatPickAnnouncement } from './pick-announcement';
import { PickEmailQueueService } from './pick-email-queue.service';

const PICK_NOTIFY_TO = 'locksonlygame@yahoo.com';
const PICK_NOTIFY_SUBJECT = 'LOCKSONLY';

@Injectable()
export class PickNotificationService {
  private readonly log = new Logger(PickNotificationService.name);

  constructor(
    private readonly queue: PickEmailQueueService,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(OddsLatest.name)
    private readonly oddsModel: Model<OddsLatestDocument>,
  ) {}

  /**
   * Queue a confirmation email. Never throws — pick save must not roll back.
   */
  async notifySavedPick(pick: PickDocument): Promise<void> {
    try {
      const user = await this.userModel
        .findById(pick.userId)
        .select('displayName')
        .lean()
        .exec();
      const displayName = user?.displayName?.trim();
      if (!displayName) {
        this.log.warn(
          `Skipping pick notification: no display name for user ${String(pick.userId)}`,
        );
        return;
      }

      const market = pick.market === 'totals' ? 'totals' : 'spreads';
      const savedLine = Number(pick.line);
      if (!Number.isFinite(savedLine)) {
        this.log.warn(
          `Skipping pick notification: saved pick ${String(pick._id)} has no numeric line`,
        );
        return;
      }

      let awayTeam: string | undefined;
      let homeTeam: string | undefined;
      if (market === 'totals') {
        const matchup = await this.getStoredMatchup(pick.eventId);
        if (!matchup) {
          this.log.warn(
            `Skipping totals pick notification: no stored matchup for event ${pick.eventId}`,
          );
          return;
        }
        awayTeam = matchup.awayTeam;
        homeTeam = matchup.homeTeam;
      }

      const body = formatPickAnnouncement({
        displayName,
        market,
        team: pick.team,
        line: savedLine,
        loy: !!pick.supercharged,
        awayTeam,
        homeTeam,
      });
      if (!body) {
        this.log.warn(
          `Skipping pick notification: could not format announcement for pick ${String(pick._id)}`,
        );
        return;
      }

      await this.queue.enqueue({
        pickId: pick._id,
        to: PICK_NOTIFY_TO,
        subject: PICK_NOTIFY_SUBJECT,
        text: body,
      });
    } catch (err) {
      this.log.error(
        `Failed to queue pick notification for pick ${String(pick._id)}`,
        err instanceof Error ? err.stack ?? err.message : String(err),
      );
    }
  }

  /** Away/home as stored on odds rows — same order as the Picks screen. */
  private async getStoredMatchup(
    eventId: string,
  ): Promise<{ awayTeam: string; homeTeam: string } | null> {
    const rows = await this.oddsModel
      .find({ eventId, market: 'spreads' })
      .select('selection team')
      .lean()
      .exec();
    const awayTeam = rows.find((row) => row.selection === 'away')?.team?.trim();
    const homeTeam = rows.find((row) => row.selection === 'home')?.team?.trim();
    if (!awayTeam || !homeTeam) return null;
    return { awayTeam, homeTeam };
  }
}
