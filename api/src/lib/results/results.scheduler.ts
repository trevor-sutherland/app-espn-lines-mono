import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ResultsService } from './results.service';

@Injectable()
export class ResultsScheduler {
  private readonly log = new Logger(ResultsScheduler.name);

  constructor(private readonly resultsService: ResultsService) {}

  /** Nightly ATS score sync + pick grading at 11:00 PM America/Chicago. */
  @Cron('0 23 * * *', { timeZone: 'America/Chicago' })
  async runNightlySync(): Promise<void> {
    this.log.log('Starting nightly results sync (11:00 PM America/Chicago)');
    try {
      const result = await this.resultsService.syncAllSports();
      this.log.log(
        `Nightly sync done: graded=${result.graded} skipped=${result.skipped}`,
      );
    } catch (err) {
      this.log.error(
        'Nightly results sync failed',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
