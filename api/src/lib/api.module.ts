import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { PicksModule } from './picks/picks.module';
import { AuthModule } from './auth/auth.module';
import { AppMailerModule } from './mailer/mailer.module';
import { EventsModule } from './events/events.module';
import { OddsModule } from './odds/odds.module';
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
    UsersModule,
    PicksModule,
    AuthModule,
    AppMailerModule,
    EventsModule,
    OddsModule,
  ],
})
export class AppEspnLinesMonoApiModule { }
