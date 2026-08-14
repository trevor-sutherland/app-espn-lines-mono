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
import { HealthModule } from './health/health.module';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { mongoConnectOptions, resolveMongoUri } from './mongo-uri';

@Module({
  controllers: [],
  providers: [],
  exports: [],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: resolveMongoUri(),
        ...mongoConnectOptions,
        retryAttempts: 2,
        retryDelay: 1000,
        lazyConnection: false,
        verboseRetryLog: true,
      }),
    }),
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
