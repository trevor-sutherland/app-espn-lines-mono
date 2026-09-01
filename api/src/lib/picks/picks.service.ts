import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Pick, PickDocument } from './picks.schema';
import { CreatePickDto } from './dto/create-pick.dto';
import { OddsLatest, OddsLatestDocument } from '../odds/odds.schema';
import { isSportKey } from '../utils/sports';

@Injectable()
export class PicksService implements OnModuleInit {
  private readonly log = new Logger(PicksService.name);

  constructor(
    @InjectModel(Pick.name) private PickModel: Model<PickDocument>,
    @InjectModel(OddsLatest.name)
    private readonly oddsModel: Model<OddsLatestDocument>,
  ) {}

  async onModuleInit() {
    try {
      await this.backfillSportKeys();
      await this.replaceLegacyIndexes();
    } catch (err) {
      this.log.error(
        'Failed to migrate pick sport indexes',
        err instanceof Error ? err.stack ?? err.message : String(err),
      );
    }
  }

  async createPick(
    dto: CreatePickDto & { supercharged?: boolean; sportKey: string },
  ) {
    try {
      const doc = await this.PickModel.create({
        userId: dto.userId,
        eventId: dto.eventId,
        sportKey: dto.sportKey,
        market: dto.market || 'spreads',
        team: dto.team,
        line: dto.line,
        season: dto.season,
        week: dto.week,
        lockedAt: dto.lockedAt,
        status: 'pending',
        supercharged: !!dto.supercharged,
      });
      return doc;
    } catch (e: unknown) {
      if (
        typeof e === 'object' &&
        e !== null &&
        'code' in e &&
        (e as { code?: number }).code === 11000
      ) {
        const keyPattern = (e as { keyPattern?: Record<string, number> })
          .keyPattern;
        if (keyPattern && !('week' in keyPattern)) {
          throw new ConflictException({
            code: 'LOY_ALREADY_USED',
            message: 'You already used your LOY this season for this sport.',
          });
        }
        throw new ConflictException(
          'You already made a pick for this sport this week',
        );
      }
      throw e;
    }
  }

  async hasSeasonLoy(
    userId: string,
    season: number,
    sportKey: string,
  ): Promise<boolean> {
    const existing = await this.PickModel.exists({
      userId,
      season,
      sportKey,
      supercharged: true,
    });
    return !!existing;
  }

  async findOneByUserSeasonWeekSport(
    userId: string,
    season: number,
    week: number,
    sportKey: string,
  ) {
    return this.PickModel.findOne({ userId, season, week, sportKey });
  }

  async getAllPicksWithUser() {
    return this.PickModel.find()
      .populate('userId', 'displayName')
      .select(
        'userId team market line season week sportKey status supercharged createdAt',
      )
      .lean();
  }

  async undoPick(pickId: string, adminUserId: string) {
    if (!Types.ObjectId.isValid(pickId)) {
      throw new NotFoundException('Pick not found');
    }
    const pick = await this.PickModel.findByIdAndDelete(pickId).exec();
    if (!pick) {
      throw new NotFoundException('Pick not found');
    }
    this.log.log(
      `Admin ${adminUserId} undid pick ${pickId} user=${pick.userId} season=${pick.season} week=${pick.week} sport=${pick.sportKey ?? ''}`,
    );
    return {
      undone: true,
      pickId,
      userId: String(pick.userId),
      season: pick.season,
      week: pick.week,
      sportKey: pick.sportKey ?? null,
    };
  }

  private async backfillSportKeys(): Promise<void> {
    const missing = await this.PickModel.find({
      $or: [
        { sportKey: { $exists: false } },
        { sportKey: null },
        { sportKey: '' },
      ],
    })
      .select('_id eventId')
      .lean()
      .exec();
    if (!missing.length) return;

    const eventIds = [...new Set(missing.map((pick) => pick.eventId))];
    const odds = await this.oddsModel
      .find({ eventId: { $in: eventIds } })
      .select('eventId sport')
      .lean()
      .exec();
    const byEvent = new Map<string, string>();
    for (const row of odds) {
      if (row.eventId && isSportKey(row.sport) && !byEvent.has(row.eventId)) {
        byEvent.set(row.eventId, row.sport);
      }
    }

    const ops = missing.map((pick) => ({
      updateOne: {
        filter: { _id: pick._id },
        update: {
          $set: {
            sportKey:
              byEvent.get(pick.eventId) || 'americanfootball_ncaaf',
          },
        },
      },
    }));
    await this.PickModel.bulkWrite(ops, { ordered: false });
    this.log.log(`Backfilled sportKey on ${ops.length} picks`);
  }

  private async replaceLegacyIndexes(): Promise<void> {
    const indexes = await this.PickModel.collection.indexes();
    for (const index of indexes) {
      const key = index.key as Record<string, number>;
      const name = index.name;
      if (!name || name === '_id_') continue;
      const isLegacyWeekUnique =
        !!index.unique &&
        key.userId === 1 &&
        key.season === 1 &&
        key.week === 1 &&
        key.sportKey == null;
      const isLegacyLoyUnique =
        !!index.unique &&
        !!index.partialFilterExpression &&
        key.userId === 1 &&
        key.season === 1 &&
        key.sportKey == null;
      if (isLegacyWeekUnique || isLegacyLoyUnique) {
        await this.PickModel.collection.dropIndex(name);
        this.log.log(`Dropped legacy pick index ${name}`);
      }
    }
    await this.PickModel.syncIndexes();
  }
}
