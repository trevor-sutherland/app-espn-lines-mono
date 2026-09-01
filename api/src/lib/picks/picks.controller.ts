import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Get,
  Query,
  Delete,
  Param,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PicksService } from './picks.service';
import { CreatePickDto } from './dto/create-pick.dto';
import { OddsService } from '../odds/odds.service';
import { UsersService } from '../users/users.service';
import { PickNotificationService } from './pick-notification.service';
import type { Request } from 'express';
import { getCurrentSeasonAndWeek } from '../utils/seasson-week.util';
import { parseSportQuery, type SportKey } from '../utils/sports';

// Extend Express Request interface to include 'user'
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      userId?: string;
      sub?: string;
      [key: string]: any;
    };
  }
}

@Controller('picks')
export class PicksController {
  private readonly log = new Logger(PicksController.name);

  constructor(
    private readonly picksService: PicksService,
    private readonly oddsService: OddsService,
    private readonly usersService: UsersService,
    private readonly pickNotifications: PickNotificationService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createPick(@Body() createPickDto: CreatePickDto, @Req() req: Request) {
    const user = req.user as { userId?: string; sub?: string };
    const userId = user.userId || user.sub;
    if (!userId) throw new ConflictException('User not authenticated');
    const current = getCurrentSeasonAndWeek();
    if (!current.picksOpen) {
      throw new ForbiddenException(
        `Picks open Tuesday at 12:00 AM Central. This week is ${current.rangeLabel}.`,
      );
    }
    const season = current.season;
    const week = current.week;
    const sportKey = await this.requireEventSportAccess(
      userId,
      createPickDto.eventId,
    );

    const existing = await this.picksService.findOneByUserSeasonWeekSport(
      userId,
      season,
      week,
      sportKey,
    );
    if (existing) {
      throw new ConflictException(
        'You already made a pick for this sport this week',
      );
    }

    const market = this.resolveMarket(createPickDto);
    const selection = this.normalizeSelection(createPickDto.team, market);
    if (!selection) {
      throw new HttpException(
        {
          code: 'INVALID_SELECTION',
          message:
            market === 'totals'
              ? 'Total picks must be Over or Under.'
              : 'A team is required for a spread pick.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const live = await this.oddsService.getDraftKingsLine(
      createPickDto.eventId,
      selection,
      market,
    );
    if (!live) {
      throw new HttpException(
        {
          code: 'LINE_UNAVAILABLE',
          message: 'Could not verify the current DraftKings line. Try again.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const submittedLine = Number(createPickDto.line);
    const currentLine = Number(live.line);
    if (
      Number.isFinite(submittedLine) &&
      submittedLine !== currentLine &&
      !createPickDto.acceptChangedLine
    ) {
      throw new HttpException(
        {
          code: 'LINE_CHANGED',
          message: 'The DraftKings line has changed.',
          eventId: createPickDto.eventId,
          team: selection,
          market,
          submittedLine,
          currentLine,
        },
        HttpStatus.CONFLICT,
      );
    }

    const wantsLoy = createPickDto.loy === true;
    if (wantsLoy) {
      const alreadyUsed = await this.picksService.hasSeasonLoy(
        userId,
        season,
        sportKey,
      );
      if (alreadyUsed) {
        throw new ConflictException({
          code: 'LOY_ALREADY_USED',
          message: 'You already used your LOY this season for this sport.',
        });
      }
    }

    const pickToSave = {
      userId,
      eventId: createPickDto.eventId,
      sportKey,
      season,
      week,
      market,
      team: selection,
      line: currentLine,
      lockedAt: new Date(),
      acceptChangedLine: createPickDto.acceptChangedLine,
      supercharged: wantsLoy,
    };

    const saved = await this.picksService.createPick(pickToSave);
    this.log.log(`Pick saved ${String(saved._id)}; queueing notification`);
    void this.pickNotifications.notifySavedPick(saved);
    return saved;
  }

  @Get('all')
  async getAllPicks() {
    return await this.picksService.getAllPicksWithUser();
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async undoPick(@Param('id') id: string, @Req() req: Request) {
    const adminId = this.requireUserId(req);
    return this.picksService.undoPick(id, adminId);
  }

  /** Current user's pick for a season/week/sport (null if none). */
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  async getMyPick(
    @Req() req: Request,
    @Query('season') seasonRaw?: string,
    @Query('week') weekRaw?: string,
    @Query('sportKey') sportKeyRaw?: string,
  ) {
    const userId = this.requireUserId(req);
    const sportKey = await this.requireQuerySportAccess(userId, sportKeyRaw);

    const fallback = getCurrentSeasonAndWeek();
    const season = seasonRaw ? Number(seasonRaw) : fallback.season;
    const week = weekRaw ? Number(weekRaw) : fallback.week;

    const existing = await this.picksService.findOneByUserSeasonWeekSport(
      userId,
      season,
      week,
      sportKey,
    );
    const loyAvailable = !(await this.picksService.hasSeasonLoy(
      userId,
      season,
      sportKey,
    ));
    if (!existing) {
      return { pick: null, loyAvailable, season, week, sportKey };
    }
    return {
      pick: {
        eventId: existing.eventId,
        team: existing.team,
        market: existing.market || 'spreads',
        line: existing.line,
        loy: !!existing.supercharged,
        season: existing.season,
        week: existing.week,
        sportKey: existing.sportKey,
        status: existing.status,
        lockedAt: existing.lockedAt,
      },
      loyAvailable,
      season,
      week,
      sportKey,
    };
  }

  @Get('has-picked')
  @UseGuards(JwtAuthGuard)
  async hasPicked(
    @Req() req: Request,
    @Query('sportKey') sportKeyRaw?: string,
  ) {
    const userId = this.requireUserId(req);
    const sportKey = await this.requireQuerySportAccess(userId, sportKeyRaw);
    const { season, week } = getCurrentSeasonAndWeek();
    const existing = await this.picksService.findOneByUserSeasonWeekSport(
      userId,
      season,
      week,
      sportKey,
    );
    return { hasPicked: !!existing, season, week, sportKey };
  }

  private requireUserId(req: Request): string {
    const user = req.user as { userId?: string; sub?: string };
    const userId = user.userId || user.sub;
    if (!userId) throw new ConflictException('User not authenticated');
    return userId;
  }

  private async requireQuerySportAccess(
    userId: string,
    sportKeyRaw?: string,
  ): Promise<SportKey> {
    const sportKey = parseSportQuery(sportKeyRaw);
    if (!sportKey) {
      throw new BadRequestException('A valid sportKey is required');
    }
    await this.assertSportAccess(userId, sportKey);
    return sportKey;
  }

  private async requireEventSportAccess(
    userId: string,
    eventId: string,
  ): Promise<SportKey> {
    const sportKey = await this.oddsService.getSportForEvent(eventId);
    if (!sportKey) {
      throw new HttpException(
        {
          code: 'UNKNOWN_EVENT',
          message: 'Could not determine the sport for this game.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.assertSportAccess(userId, sportKey);
    return sportKey;
  }

  private async assertSportAccess(userId: string, sportKey: SportKey) {
    const allowed = await this.usersService.getAllowedSports(userId);
    if (!allowed.includes(sportKey)) {
      throw new ForbiddenException('You do not have access to this sport.');
    }
  }

  private resolveMarket(dto: CreatePickDto): 'spreads' | 'totals' {
    if (dto.market === 'totals' || dto.market === 'spreads') {
      return dto.market;
    }
    const name = (dto.team || '').trim().toLowerCase();
    if (name === 'over' || name === 'under') {
      return 'totals';
    }
    return 'spreads';
  }

  private normalizeSelection(
    team: string,
    market: 'spreads' | 'totals',
  ): string | null {
    const trimmed = (team || '').trim();
    if (!trimmed) return null;
    if (market !== 'totals') return trimmed;
    const key = trimmed.toLowerCase();
    if (key === 'over') return 'Over';
    if (key === 'under') return 'Under';
    return null;
  }
}
