import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SeasonPot, SeasonPotDocument } from './pot.schema';
import { UsersService } from '../users/users.service';
import { getCurrentSeasonAndWeek } from '../utils/seasson-week.util';

export type PotMemberRow = {
  userId: string;
  email: string;
  displayName: string;
  paid: boolean;
  paidAt?: Date;
};

export type SeasonPotView = {
  season: number;
  potAmount: number;
  adminFeePercent: number;
  adminFeeAmount: number;
  totalCollect: number;
  shareAmount: number;
  paidCount: number;
  memberCount: number;
  members: PotMemberRow[];
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class PotService {
  constructor(
    @InjectModel(SeasonPot.name)
    private readonly potModel: Model<SeasonPotDocument>,
    private readonly usersService: UsersService,
  ) {}

  private async getOrCreate(season: number): Promise<SeasonPotDocument> {
    let pot = await this.potModel.findOne({ season }).exec();
    if (!pot) {
      pot = await this.potModel.create({
        season,
        potAmount: 0,
        adminFeePercent: 0,
        payments: [],
      });
    } else if (pot.adminFeePercent == null) {
      pot.adminFeePercent = 0;
      await pot.save();
    }
    return pot;
  }

  private resolveSeason(season?: number): number {
    if (season == null || Number.isNaN(season)) {
      return getCurrentSeasonAndWeek().season;
    }
    if (!Number.isInteger(season) || season < 2000 || season > 2100) {
      throw new BadRequestException('Invalid season');
    }
    return season;
  }

  async getSeasonPot(season?: number): Promise<SeasonPotView> {
    const year = this.resolveSeason(season);
    const pot = await this.getOrCreate(year);
    const users = (await this.usersService.listUsers()).filter(
      (u) => u.approved && u.active !== false,
    );

    const paidByUser = new Map(
      (pot.payments ?? []).map((p) => [
        String(p.userId),
        { paid: !!p.paid, paidAt: p.paidAt },
      ]),
    );

    const members: PotMemberRow[] = users
      .map((u) => {
        const entry = paidByUser.get(u.id);
        return {
          userId: u.id,
          email: u.email,
          displayName: u.displayName,
          paid: entry?.paid ?? false,
          paidAt: entry?.paidAt,
        };
      })
      .sort((a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, {
          sensitivity: 'base',
        }),
      );

    const memberCount = members.length;
    const paidCount = members.filter((m) => m.paid).length;
    const potAmount = Number(pot.potAmount) || 0;
    const adminFeePercent = Number(pot.adminFeePercent) || 0;
    const adminFeeAmount = roundMoney(potAmount * (adminFeePercent / 100));
    const totalCollect = roundMoney(potAmount + adminFeeAmount);
    const shareAmount =
      memberCount > 0 ? roundMoney(totalCollect / memberCount) : 0;

    return {
      season: year,
      potAmount,
      adminFeePercent,
      adminFeeAmount,
      totalCollect,
      shareAmount,
      paidCount,
      memberCount,
      members,
    };
  }

  async setSettings(
    season: number,
    potAmount: number,
    adminFeePercent: number,
  ): Promise<SeasonPotView> {
    const year = this.resolveSeason(season);
    if (typeof potAmount !== 'number' || Number.isNaN(potAmount) || potAmount < 0) {
      throw new BadRequestException('potAmount must be a non-negative number');
    }
    if (
      typeof adminFeePercent !== 'number' ||
      Number.isNaN(adminFeePercent) ||
      adminFeePercent < 0 ||
      adminFeePercent > 100
    ) {
      throw new BadRequestException(
        'adminFeePercent must be a number between 0 and 100',
      );
    }
    const pot = await this.getOrCreate(year);
    pot.potAmount = roundMoney(potAmount);
    pot.adminFeePercent = roundMoney(adminFeePercent);
    await pot.save();
    return this.getSeasonPot(year);
  }

  async setPaid(
    season: number,
    userId: string,
    paid: boolean,
  ): Promise<SeasonPotView> {
    const year = this.resolveSeason(season);
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    const users = await this.usersService.listUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) throw new NotFoundException('User not found');

    const pot = await this.getOrCreate(year);
    const oid = new Types.ObjectId(userId);
    const existing = (pot.payments ?? []).find(
      (p) => String(p.userId) === userId,
    );

    if (existing) {
      existing.paid = !!paid;
      existing.paidAt = paid ? new Date() : undefined;
    } else {
      pot.payments.push({
        userId: oid,
        paid: !!paid,
        paidAt: paid ? new Date() : undefined,
      });
    }

    await pot.save();
    return this.getSeasonPot(year);
  }
}
