import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PicksService } from './picks.service';
import { PicksController } from './picks.controller';
import { Pick, PickSchema } from './picks.schema';
import { Event, EventSchema } from '../events/events.schema';
import { OddsLatest, OddsLatestSchema } from '../odds/odds.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Pick.name, schema: PickSchema },
      { name: Event.name, schema: EventSchema },
      { name: OddsLatest.name, schema: OddsLatestSchema },
    ]),
  ],
  controllers: [PicksController],
  providers: [PicksService],
  exports: [PicksService],
})
export class PicksModule {}
