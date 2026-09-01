import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { MailerService } from '@nestjs-modules/mailer';
import { Model, Types } from 'mongoose';
import {
  PickEmailOutbox,
  PickEmailOutboxDocument,
} from './pick-email-outbox.schema';

const DEFAULT_DELAY_MS = 2 * 60 * 1000;
const STALE_SENDING_MS = 2 * 60 * 1000;
const GAP_BETWEEN_SENDS_MS = 1500;
const MAX_ATTEMPTS = 5;

@Injectable()
export class PickEmailQueueService implements OnModuleInit {
  private readonly log = new Logger(PickEmailQueueService.name);
  private draining = false;

  constructor(
    @InjectModel(PickEmailOutbox.name)
    private readonly outboxModel: Model<PickEmailOutboxDocument>,
    private readonly mailerService: MailerService,
  ) {}

  onModuleInit() {
    void this.drainDue().catch((err) =>
      this.log.error(
        'Startup pick-email drain failed',
        err instanceof Error ? err.stack ?? err.message : String(err),
      ),
    );
  }

  delayMs(): number {
    const raw = Number(process.env.PICK_EMAIL_DELAY_MS);
    return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_DELAY_MS;
  }

  async enqueue(job: {
    pickId: Types.ObjectId | string;
    to: string;
    subject: string;
    text: string;
  }): Promise<void> {
    const pickId = new Types.ObjectId(String(job.pickId));
    const availableAt = new Date(Date.now() + this.delayMs());
    try {
      await this.outboxModel.create({
        pickId,
        to: job.to,
        subject: job.subject,
        text: job.text,
        status: 'pending',
        availableAt,
        attempts: 0,
      });
      this.log.log(
        `Queued pick email ${String(pickId)} for ${availableAt.toISOString()}`,
      );
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code?: number }).code === 11000
      ) {
        this.log.log(`Pick email already queued for ${String(pickId)}`);
        return;
      }
      throw err;
    }
  }

  @Interval(15_000)
  async tick(): Promise<void> {
    await this.drainDue();
  }

  async drainDue(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      await this.reclaimStale();
      for (;;) {
        const job = await this.claimNext();
        if (!job) break;
        await this.sendClaimed(job);
        await delay(GAP_BETWEEN_SENDS_MS);
      }
    } catch (err) {
      this.log.error(
        'Pick email drain failed',
        err instanceof Error ? err.stack ?? err.message : String(err),
      );
    } finally {
      this.draining = false;
    }
  }

  private async reclaimStale(): Promise<void> {
    const staleBefore = new Date(Date.now() - STALE_SENDING_MS);
    const result = await this.outboxModel.updateMany(
      { status: 'sending', claimedAt: { $lte: staleBefore } },
      { $set: { status: 'pending' }, $unset: { claimedAt: 1 } },
    );
    if (result.modifiedCount) {
      this.log.warn(
        `Requeued ${result.modifiedCount} stale pick email(s) stuck in sending`,
      );
    }
  }

  private async claimNext(): Promise<PickEmailOutboxDocument | null> {
    return this.outboxModel
      .findOneAndUpdate(
        { status: 'pending', availableAt: { $lte: new Date() } },
        { $set: { status: 'sending', claimedAt: new Date() } },
        { sort: { availableAt: 1, createdAt: 1 }, new: true },
      )
      .exec();
  }

  private async sendClaimed(job: PickEmailOutboxDocument): Promise<void> {
    const pickId = String(job.pickId);
    try {
      await this.mailerService.sendMail({
        to: job.to,
        subject: job.subject,
        text: job.text,
        template: 'pick-announcement',
        context: { body: job.text },
        headers: {
          'Message-ID': `<pick-${pickId}@locksonly>`,
        },
      });
      job.status = 'sent';
      job.sentAt = new Date();
      job.lastError = undefined;
      job.claimedAt = undefined;
      await job.save();
      this.log.log(`Pick notification sent for pick ${pickId}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.stack ?? err.message : String(err);
      job.attempts = (job.attempts || 0) + 1;
      job.lastError = message.slice(0, 1000);
      job.claimedAt = undefined;
      if (job.attempts >= MAX_ATTEMPTS) {
        job.status = 'failed';
        this.log.error(
          `Pick notification failed permanently for pick ${pickId} after ${job.attempts} attempts`,
          message,
        );
      } else {
        job.status = 'pending';
        job.availableAt = new Date(Date.now() + this.delayMs());
        this.log.error(
          `Pick notification send failed for pick ${pickId}; retry ${job.attempts}/${MAX_ATTEMPTS} at ${job.availableAt.toISOString()}`,
          message,
        );
      }
      await job.save();
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
