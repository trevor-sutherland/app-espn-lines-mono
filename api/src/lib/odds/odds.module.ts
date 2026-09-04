import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OddsService } from './odds.service';
import { OddsController } from './odds.controller';
import { OddsScheduler } from './odds.scheduler';
import { OddsLatest, OddsLatestSchema } from './odds.schema';
import { OddsUsage, OddsUsageSchema } from './odds-usage.schema';
import { OddsUsageService } from './odds-usage.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OddsLatest.name, schema: OddsLatestSchema },
      { name: OddsUsage.name, schema: OddsUsageSchema },
    ]),
  ],
  controllers: [OddsController],
  providers: [OddsService, OddsScheduler, OddsUsageService],
  exports: [OddsService, OddsUsageService],
})
export class OddsModule {}
