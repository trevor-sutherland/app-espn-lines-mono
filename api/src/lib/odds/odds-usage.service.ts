import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OddsUsage, OddsUsageDocument } from './odds-usage.schema';

export type OddsUsageSnapshot = {
  used: number | null;
  remaining: number | null;
  lastCost: number | null;
  lastCalledAt: string | null;
  lastPath: string;
  quotaExceeded: boolean;
};

@Injectable()
export class OddsUsageService {
  private readonly log = new Logger(OddsUsageService.name);

  constructor(
    @InjectModel(OddsUsage.name)
    private readonly usageModel: Model<OddsUsageDocument>,
  ) {}

  async recordFromHeaders(
    headers: unknown,
    path: string,
    quotaExceeded = false,
  ): Promise<void> {
    const usage = this.readUsageHeaders(headers);
    const set: Record<string, unknown> = {
      lastCalledAt: new Date(),
      lastPath: path.slice(0, 160),
      quotaExceeded,
    };
    if (usage.used != null) set.used = usage.used;
    if (usage.remaining != null) {
      set.remaining = usage.remaining;
      if (usage.remaining > 0) set.quotaExceeded = false;
    }
    if (usage.lastCost != null) set.lastCost = usage.lastCost;
    if (quotaExceeded) set.quotaExceeded = true;

    try {
      await this.usageModel.updateOne({ key: 'default' }, { $set: set }, { upsert: true });
    } catch (err) {
      this.log.warn(
        `Could not persist Odds API usage: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async getSnapshot(): Promise<OddsUsageSnapshot> {
    const row = await this.usageModel.findOne({ key: 'default' }).lean().exec();
    return {
      used: row?.used ?? null,
      remaining: row?.remaining ?? null,
      lastCost: row?.lastCost ?? null,
      lastCalledAt: row?.lastCalledAt
        ? new Date(row.lastCalledAt).toISOString()
        : null,
      lastPath: row?.lastPath ?? '',
      quotaExceeded: row?.quotaExceeded === true,
    };
  }

  private readUsageHeaders(headers: unknown): {
    used?: number;
    remaining?: number;
    lastCost?: number;
  } {
    const get = (name: string): unknown => {
      if (!headers || typeof headers !== 'object') return undefined;
      const rec = headers as Record<string, unknown> & {
        get?: (key: string) => unknown;
      };
      if (typeof rec.get === 'function') {
        return rec.get(name);
      }
      return rec[name] ?? rec[name.toLowerCase()];
    };
    const num = (name: string): number | undefined => {
      const raw = get(name);
      const value = Array.isArray(raw) ? raw[0] : raw;
      if (value == null || value === '') return undefined;
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? n : undefined;
    };
    return {
      used: num('x-requests-used') ?? num('x-requests-used-per-month'),
      remaining: num('x-requests-remaining'),
      lastCost: num('x-requests-last'),
    };
  }
}
