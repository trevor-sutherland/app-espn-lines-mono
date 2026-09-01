import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PicksService } from './picks.service';
import { PicksController } from './picks.controller';
import { Pick, PickSchema } from './picks.schema';
import { Event, EventSchema } from '../events/events.schema';
import { OddsLatest, OddsLatestSchema } from '../odds/odds.schema';
import { OddsModule } from '../odds/odds.module';
import { UsersModule } from '../users/users.module';
import { AppMailerModule } from '../mailer/mailer.module';
import { PickNotificationService } from './pick-notification.service';

@Module({
  imports: [
    OddsModule,
    UsersModule,
    AppMailerModule,
    MongooseModule.forFeature([
      { name: Pick.name, schema: PickSchema },
      { name: Event.name, schema: EventSchema },
      { name: OddsLatest.name, schema: OddsLatestSchema },
    ]),
  ],
  controllers: [PicksController],
  providers: [PicksService, PickNotificationService],
  exports: [PicksService],
})
export class PicksModule {}
