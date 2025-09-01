import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  ConflictException,
  Get,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { PicksService } from './picks.service';
import { CreatePickDto } from './dto/create-pick.dto';
import type { Request } from 'express';
import { getCurrentSeasonAndWeek } from '../utils/seasson-week.util';

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
  constructor(private readonly picksService: PicksService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createPick(@Body() createPickDto: CreatePickDto, @Req() req: Request) {
    // Get userId from JWT payload
    const user = req.user as { userId?: string; sub?: string };
    const userId = user.userId || user.sub;
    if (!userId) throw new ConflictException('User not authenticated');
    const { season, week } = createPickDto
    console.log(createPickDto);

    // Check for existing pick
    const existing = await this.picksService.findOneByUserSeasonWeek(
      userId,
      season,
      week,
    );
    if (existing) {
      throw new ConflictException('You already made a pick for this week');
    }

    const pickToSave = {
      ...createPickDto,
      userId,
      season,
      week,
      lockedAt: new Date(),
    };

    console.log(pickToSave);
    // Save the pick (assuming your service expects userId and the DTO)
    return this.picksService.createPick(pickToSave);
  }

  @Get('all')
  async getAllPicks() {
    // Populate userId with displayName from users collection
    return await this.picksService.getAllPicksWithUser();
  }

  @Get('has-picked')
  @UseGuards(JwtAuthGuard)
  async hasPicked(@Req() req: Request) {
    const user = req.user as { userId: string; sub: string };
    const userId = user.userId || user.sub;
    const { season, week } = getCurrentSeasonAndWeek();
    const existing = await this.picksService.findOneByUserSeasonWeek(
      userId,
      season,
      week,
    );
    return { hasPicked: !!existing, season, week };
  }
}
