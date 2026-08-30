import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OddsService } from './odds.service';

@Injectable()
export class OddsScheduler {
  private readonly log = new Logger(OddsScheduler.name);

  constructor(private readonly oddsService: OddsService) {}

  /** Refresh DraftKings spreads for all sports every hour. */
  @Cron('0 * * * *', { timeZone: 'America/Chicago' })
  async refreshHourly(): Promise<void> {
    this.log.log('Starting hourly odds refresh');
    try {
      const result = await this.oddsService.refreshAllSports();
      this.log.log(
        `Hourly odds refresh done: updated=${result.updated} inserted=${result.inserted}`,
      );
    } catch (err) {
      this.log.error(
        'Hourly odds refresh failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
