import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from './users/users.module';
import { PicksModule } from './picks/picks.module';
import { AuthModule } from './auth/auth.module';
import { AppMailerModule } from './mailer/mailer.module';
import { EventsModule } from './events/events.module';
import { OddsModule } from './odds/odds.module';
import { ResultsModule } from './results/results.module';
import { PotModule } from './pot/pot.module';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  controllers: [],
  providers: [],
  exports: [],
  imports: [
    MongooseModule.forRoot(
      process.env.MONGO_URI || 'mongodb://localhost:27017/espn-lines',
    ),
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    UsersModule,
    PicksModule,
    AuthModule,
    AppMailerModule,
    EventsModule,
    OddsModule,
    ResultsModule,
    PotModule,
  ],
})
export class AppEspnLinesMonoApiModule { }
