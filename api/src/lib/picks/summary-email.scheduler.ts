import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SummaryEmailService } from './summary-email.service';

/**
 * Sends LOCKSONLY NCAAF weekly pick snapshots to the group email.
 * Times are America/Chicago. The outbox unique index prevents double-sends
 * even if Cloud Run restarts between cron fires.
 */
@Injectable()
export class SummaryEmailScheduler {
  private readonly log = new Logger(SummaryEmailScheduler.name);

  constructor(private readonly summaryEmail: SummaryEmailService) {}

  /** Thursday 3:00 PM CT */
  @Cron('0 15 * * 4', { timeZone: 'America/Chicago' })
  async runThursday(): Promise<void> {
    this.log.log('Sending Thursday 3pm NCAAF summary email');
    await this.summaryEmail.sendSnapshot('thu-3pm');
  }

  /** Friday 8:00 PM CT */
  @Cron('0 20 * * 5', { timeZone: 'America/Chicago' })
  async runFriday(): Promise<void> {
    this.log.log('Sending Friday 8pm NCAAF summary email');
    await this.summaryEmail.sendSnapshot('fri-8pm');
  }

  /** Saturday 11:00 AM CT */
  @Cron('0 11 * * 6', { timeZone: 'America/Chicago' })
  async runSaturday(): Promise<void> {
    this.log.log('Sending Saturday 11am NCAAF summary email');
    await this.summaryEmail.sendSnapshot('sat-11am');
  }
}
