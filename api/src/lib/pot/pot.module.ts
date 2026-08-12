import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SeasonPot, SeasonPotSchema } from './pot.schema';
import { PotController } from './pot.controller';
import { PotService } from './pot.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SeasonPot.name, schema: SeasonPotSchema },
    ]),
    UsersModule,
  ],
  controllers: [PotController],
  providers: [PotService],
  exports: [PotService],
})
export class PotModule {}
