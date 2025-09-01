import { Controller, Post, Body } from '@nestjs/common';
import { OddsService } from './odds.service';

import { GetOddsDto } from './dto/get-odds.dto';

@Controller('odds')
export class OddsController {
  constructor(private readonly oddsService: OddsService) {}

  @Post('current-week')
  async getCurrentWeekOdds(@Body() body: GetOddsDto) {
    console.log(body)
    const { sportKey } = body;
    console.log(sportKey);
    const { rows } = await this.oddsService.fetchNflMainlines(sportKey);
    console.log(rows);
    return rows;
  }
}
