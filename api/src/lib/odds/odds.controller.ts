import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { OddsService } from './odds.service';
import { OddsUsageService } from './odds-usage.service';
import { GetOddsDto } from './dto/get-odds.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('odds')
export class OddsController {
  constructor(
    private readonly oddsService: OddsService,
    private readonly usageTracker: OddsUsageService,
  ) {}

  @Get('usage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getUsage() {
    return this.usageTracker.getSnapshot();
  }

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
