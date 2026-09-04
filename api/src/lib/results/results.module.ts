import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GameResult, GameResultSchema } from './game-result.schema';
import { Pick, PickSchema } from '../picks/picks.schema';
import { User, UserSchema } from '../users/users.schema';
import { ResultsService } from './results.service';
import { ResultsController } from './results.controller';
import { ResultsScheduler } from './results.scheduler';
import { OddsModule } from '../odds/odds.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GameResult.name, schema: GameResultSchema },
      { name: Pick.name, schema: PickSchema },
      { name: User.name, schema: UserSchema },
    ]),
    OddsModule,
  ],
  controllers: [ResultsController],
  providers: [ResultsService, ResultsScheduler],
  exports: [ResultsService],
})
export class ResultsModule {}
