// picks/picks.service.ts
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Pick, PickDocument } from './picks.schema';
import { CreatePickDto } from './dto/create-pick.dto';

@Injectable()
export class PicksService {
  constructor(@InjectModel(Pick.name) private PickModel: Model<PickDocument>) {}

  async createPick(dto: CreatePickDto) {
    // 1) Enforce one pick per user per week (unique index + friendly error)
    try {
      const doc = await this.PickModel.create({
        userId: dto.userId,
        eventId: dto.eventId,
        team: dto.team,
        line: dto.line,
        season: dto.season,
        week: dto.week,
        lockedAt: dto.lockedAt,
        status: 'pending',
      });
      return doc;
    } catch (e: any) {
      if (
        typeof e === 'object' &&
        e !== null &&
        'code' in e &&
        (e as { code?: number }).code === 11000
      ) {
        throw new ConflictException('You already made a pick for this week');
      }
      throw e;
    }
  }

  async listMyPicks(userIdStr: string, season?: number, week?: number) {
    const q: { userId: Types.ObjectId; season?: number; week?: number } = {
      userId: new Types.ObjectId(userIdStr),
    };
    if (season) q.season = season;
    if (week) q.week = week;
    return this.PickModel.find(q).sort({ createdAt: -1 }).lean();
  }

  async findOneByUserSeasonWeek(userId: string, season: number, week: number) {
    return this.PickModel.findOne({ userId, season, week });
  }

  async getAllPicksWithUser() {
    return this.PickModel.find()
      .populate('userId', 'displayName') // assumes userId is a ref to User
      .select('userId team line season week status createdAt')
      .lean();
  }
}
