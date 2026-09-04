import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ResultsService } from './results.service';

@Injectable()
export class ResultsScheduler {
  private readonly log = new Logger(ResultsScheduler.name);

  constructor(private readonly resultsService: ResultsService) {}

  /** ATS score sync + pick grading: Thu/Fri 11:00 PM CT, Sunday 1:00 AM CT. */
  @Cron('0 23 * * 4,5', { timeZone: 'America/Chicago' })
  @Cron('0 1 * * 0', { timeZone: 'America/Chicago' })
  async runScheduledSync(): Promise<void> {
    if (process.env.ODDS_SCHEDULER_ENABLED === 'false') {
      this.log.log('Results scheduler disabled (ODDS_SCHEDULER_ENABLED=false)');
      return;
    }
    this.log.log('Starting scheduled results sync');
    try {
      const result = await this.resultsService.syncAllSports();
      this.log.log(
        `Weekend results sync done: graded=${result.graded} skipped=${result.skipped}`,
      );
    } catch (err) {
      this.log.error(
        'Nightly results sync failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
