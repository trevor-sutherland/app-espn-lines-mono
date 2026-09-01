import { IsArray, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ALL_SPORT_KEYS } from '../../utils/sports';
import type { UserRole } from '../users.schema';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsOptional()
  @IsIn(['user', 'admin'])
  role?: UserRole;

  @IsOptional()
  @IsArray()
  @IsIn(ALL_SPORT_KEYS, { each: true })
  sports?: string[];
}
