import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OddsService } from './odds.service';
import { OddsController } from './odds.controller';
import { OddsScheduler } from './odds.scheduler';
import { OddsLatest, OddsLatestSchema } from './odds.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OddsLatest.name, schema: OddsLatestSchema },
    ]),
  ],
  controllers: [OddsController],
  providers: [OddsService, OddsScheduler],
  exports: [OddsService],
})
export class OddsModule {}
