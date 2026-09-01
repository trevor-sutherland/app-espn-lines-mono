import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/users.schema';
import { Pick, PickSchema } from '../picks/picks.schema';
import { OddsLatest, OddsLatestSchema } from '../odds/odds.schema';
import { ScoreboardService } from './scoreboard.service';
import { ScoreboardController } from './scoreboard.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Pick.name, schema: PickSchema },
      { name: OddsLatest.name, schema: OddsLatestSchema },
    ]),
  ],
  controllers: [ScoreboardController],
  providers: [ScoreboardService],
})
export class ScoreboardModule {}
