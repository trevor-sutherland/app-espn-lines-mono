import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @Transform(({ value }) => (value === '' || value == null ? undefined : value))
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
