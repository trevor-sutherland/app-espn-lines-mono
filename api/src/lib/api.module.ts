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

function mongoUri(): string {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (uri) {
    return uri;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'MONGO_URI (or MONGODB_URI) must be set. Cloud Run has no local MongoDB; pointing at localhost will hang until the startup probe fails.',
    );
  }
  return 'mongodb://localhost:27017/espn-lines';
}

@Module({
  controllers: [],
  providers: [],
  exports: [],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    MongooseModule.forRoot(mongoUri(), {
      serverSelectionTimeoutMS: 10_000,
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
