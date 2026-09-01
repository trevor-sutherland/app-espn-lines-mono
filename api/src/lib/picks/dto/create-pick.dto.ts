import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePickDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @IsOptional()
  @IsIn(['spreads', 'totals'])
  market?: 'spreads' | 'totals';

  @IsString()
  @IsNotEmpty()
  team!: string;

  @IsNumber()
  @Type(() => Number)
  line!: number; // allow decimals for spreads/totals

  @IsInt()
  @Type(() => Number)
  @Min(1)
  week!: number;

  @IsInt()
  @Type(() => Number)
  @Min(1900)
  season!: number;

  @IsOptional()
  @IsString()
  sportKey?: string;

  lockedAt?: Date;

  /** When true, save the current DraftKings line even if it differs from `line`. */
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  acceptChangedLine?: boolean;

  /** Client request to apply this season's one LOY. Server re-checks eligibility. */
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  loy?: boolean;
}
