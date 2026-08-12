import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GameResult, GameResultSchema } from './game-result.schema';
import { Pick, PickSchema } from '../picks/picks.schema';
import { ResultsService } from './results.service';
import { ResultsController } from './results.controller';
import { ResultsScheduler } from './results.scheduler';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GameResult.name, schema: GameResultSchema },
      { name: Pick.name, schema: PickSchema },
    ]),
  ],
  controllers: [ResultsController],
  providers: [ResultsService, ResultsScheduler],
  exports: [ResultsService],
})
export class ResultsModule {}
