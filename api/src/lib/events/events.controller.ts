import { Body, Controller, Post } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventDto } from './dto/event.dto';
import { GetOddsDto } from '../odds/dto/get-odds.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  async getEvents(@Body() body: GetOddsDto): Promise<EventDto[]> {
    const { sportKey } = body;
    return this.eventsService.getSportEvents(sportKey);
  }
}
