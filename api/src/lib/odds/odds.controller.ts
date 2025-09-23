import { Controller, Post, Body } from '@nestjs/common';
import { OddsService } from './odds.service';

import { GetOddsDto } from './dto/get-odds.dto';

@Controller('odds')
export class OddsController {
  constructor(private readonly oddsService: OddsService) {}

  @Post('current-week')
  async getCurrentWeekOdds(@Body() body: GetOddsDto) {
    const { sportKey } = body;
    const { rows } = await this.oddsService.fetchSportMainlines(sportKey);
    return rows;
  }

  @Post('all')
  async getAllOdds(@Body() body: GetOddsDto) {
  const { sportKey } = body;
  return await this.oddsService.getAllOdds(sportKey);
  }

  @Post('current-week/save')
  async fetchAndSave(@Body() body: GetOddsDto) {
    const { sportKey } = body;
    const result = await this.oddsService.fetchAndSaveSportMainlines(sportKey);
    return result;
  }
}
