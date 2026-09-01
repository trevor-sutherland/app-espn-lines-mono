import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { ScoreboardService } from './scoreboard.service';
import { parseSportQuery } from '../utils/sports';

@Controller('scoreboard')
@UseGuards(JwtAuthGuard)
export class ScoreboardController {
  constructor(private readonly scoreboardService: ScoreboardService) {}

  @Get()
  async getScoreboard(
    @Query('season') seasonRaw?: string,
    @Query('sportKey') sportKeyRaw?: string,
  ) {
    const season = seasonRaw ? Number(seasonRaw) : undefined;
    const sportKey = parseSportQuery(sportKeyRaw);
    if (!sportKey) {
      throw new BadRequestException('A valid sportKey is required');
    }
    return this.scoreboardService.getScoreboard(
      Number.isFinite(season) ? season : undefined,
      sportKey,
    );
  }

  @Get('players/:userId')
  async getPlayer(
    @Param('userId') userId: string,
    @Query('season') seasonRaw?: string,
    @Query('sportKey') sportKeyRaw?: string,
  ) {
    const season = seasonRaw ? Number(seasonRaw) : undefined;
    const sportKey = parseSportQuery(sportKeyRaw);
    if (!sportKey) {
      throw new BadRequestException('A valid sportKey is required');
    }
    return this.scoreboardService.getPlayer(
      userId,
      Number.isFinite(season) ? season : undefined,
      sportKey,
    );
  }
}
