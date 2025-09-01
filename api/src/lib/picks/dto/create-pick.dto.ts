import { IsInt, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePickDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
  @IsString()
  @IsNotEmpty()
  eventId!: string;

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

  lockedAt?: Date;
}
