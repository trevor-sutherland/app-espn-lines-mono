import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EventDto } from './dto/event.dto';
import { OddsUsageService } from '../odds/odds-usage.service';

@Injectable()
export class EventsService {
  constructor(
    private config: ConfigService,
    private readonly usageTracker: OddsUsageService,
  ) {}

  async getSportEvents(sportKey: string): Promise<EventDto[]> {
    const oddsUri = this.config.get<string>('ODDS_URI');
    const apiKey = this.config.get<string>('ODDS_API_KEY');
    const url = `${oddsUri}/sports/${sportKey}/events`;
    try {
      const { data, headers } = await axios.get<EventDto[]>(url, {
        params: { apiKey },
      });
      void this.usageTracker.recordFromHeaders(headers, `/sports/${sportKey}/events`);
      return data;
    } catch (err: unknown) {
      if (typeof err === 'object' && err && 'response' in err) {
        const res = (
          err as {
            response?: {
              headers?: unknown;
              status?: number;
              data?: { error_code?: string };
            };
          }
        ).response;
        void this.usageTracker.recordFromHeaders(
          res?.headers,
          `/sports/${sportKey}/events`,
          res?.status === 401 && res.data?.error_code === 'OUT_OF_USAGE_CREDITS',
        );
      }
      throw err;
    }
  }
}
