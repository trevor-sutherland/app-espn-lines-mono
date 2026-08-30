import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
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
}
