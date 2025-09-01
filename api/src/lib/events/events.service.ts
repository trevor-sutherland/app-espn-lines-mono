import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EventDto } from './dto/event.dto';

@Injectable()
export class EventsService {
  constructor(private config: ConfigService) {}

  async getNflEvents(sportKey: string): Promise<EventDto[]> {
    const oddsUri = this.config.get<string>('ODDS_URI');
    const apiKey = this.config.get<string>('ODDS_API_KEY');
    const url = `${oddsUri}/sports/${sportKey}/events`;
    const { data } = await axios.get<EventDto[]>(url, { params: { apiKey } });
    return data;
  }
}
