import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OddsService } from './odds.service';

@Injectable()
export class OddsScheduler {
  private readonly log = new Logger(OddsScheduler.name);

  constructor(private readonly oddsService: OddsService) {}

  /**
   * DraftKings mainlines, 2×/day Central (8:00 AM and 8:00 PM).
   * Set ODDS_SCHEDULER_ENABLED=false on local so Cloud Run is the only poller.
   */
  @Cron('0 8,20 * * *', { timeZone: 'America/Chicago' })
  async refreshScheduled(): Promise<void> {
    if (process.env.ODDS_SCHEDULER_ENABLED === 'false') {
      this.log.log('Odds scheduler disabled (ODDS_SCHEDULER_ENABLED=false)');
      return;
    }
    this.log.log('Starting scheduled odds refresh');
    try {
      const result = await this.oddsService.refreshAllSports();
      this.log.log(
        `Scheduled odds refresh done: updated=${result.updated} inserted=${result.inserted}`,
      );
    } catch (err) {
      this.log.error(
        'Scheduled odds refresh failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
