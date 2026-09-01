import { BadRequestException, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ResultsService } from './results.service';
import { parseSportQuery } from '../utils/sports';

@Controller('results')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Get('standings')
  @UseGuards(JwtAuthGuard)
  async getStandings(
    @Query('season') seasonRaw?: string,
    @Query('sportKey') sportKeyRaw?: string,
  ) {
    const season = seasonRaw ? Number(seasonRaw) : undefined;
    const sportKey = parseSportQuery(sportKeyRaw);
    if (!sportKey) {
      throw new BadRequestException('A valid sportKey is required');
    }
    const standings = await this.resultsService.getStandings(
      Number.isFinite(season) ? season : undefined,
      sportKey,
    );
    return { standings };
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async sync() {
    return this.resultsService.syncAllSports();
  }
}
