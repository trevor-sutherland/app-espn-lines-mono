import { Controller, Post, Query } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventDto } from './dto/event.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post('events')
  async getEvents(@Query('sportKey') sportKey: string): Promise<EventDto[]> {
    // You may want to validate sportKey or provide a default
    return this.eventsService.getNflEvents(sportKey);
  }
}
