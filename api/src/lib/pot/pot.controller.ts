import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PotService } from './pot.service';

@Controller('pot')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class PotController {
  constructor(private readonly potService: PotService) {}

  @Get()
  async get(@Query('season') season?: string) {
    const year = season != null && season !== '' ? Number(season) : undefined;
    return this.potService.getSeasonPot(year);
  }

  @Patch(':season/settings')
  async setSettings(
    @Param('season') season: string,
    @Body() body: { potAmount: number; adminFeePercent: number },
  ) {
    return this.potService.setSettings(
      Number(season),
      Number(body.potAmount),
      Number(body.adminFeePercent),
    );
  }

  @Patch(':season/users/:userId/paid')
  async setPaid(
    @Param('season') season: string,
    @Param('userId') userId: string,
    @Body() body: { paid: boolean },
  ) {
    return this.potService.setPaid(Number(season), userId, !!body.paid);
  }
}
