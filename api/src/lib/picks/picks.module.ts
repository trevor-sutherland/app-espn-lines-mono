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
import { PickEmailQueueService } from './pick-email-queue.service';
import { SummaryEmailService } from './summary-email.service';
import {
  PickEmailOutbox,
  PickEmailOutboxSchema,
} from './pick-email-outbox.schema';
import { User, UserSchema } from '../users/users.schema';

@Module({
  imports: [
    OddsModule,
    UsersModule,
    AppMailerModule,
    MongooseModule.forFeature([
      { name: Pick.name, schema: PickSchema },
      { name: Event.name, schema: EventSchema },
      { name: OddsLatest.name, schema: OddsLatestSchema },
      { name: PickEmailOutbox.name, schema: PickEmailOutboxSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [PicksController],
  providers: [
    PicksService,
    PickNotificationService,
    PickEmailQueueService,
    SummaryEmailService,
  ],
  exports: [PicksService],
})
export class PicksModule {}
