import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { ConfigModule } from '@nestjs/config';
import { OddsModule } from '../odds/odds.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), OddsModule],
  providers: [EventsService],
  controllers: [EventsController],
})
export class EventsModule {}
