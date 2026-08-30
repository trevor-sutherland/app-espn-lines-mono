import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UsersService } from './users.service';
import type { UserRole } from './users.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async listUsers() {
    const users = await this.usersService.listUsers();
    return { users };
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }

  @Patch(':id/approve')
  async approve(@Param('id') id: string) {
    return this.usersService.setApproved(id, true);
  }

  @Patch(':id/deny')
  async deny(@Param('id') id: string) {
    return this.usersService.setApproved(id, false);
  }

  @Patch(':id/role')
  async setRole(
    @Param('id') id: string,
    @Body() body: { role: UserRole },
  ) {
    return this.usersService.setRole(id, body.role);
  }

  @Patch(':id')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(id, dto);
  }

  @Patch(':id/active')
  async setActive(
    @Param('id') id: string,
    @Body() body: { active: boolean },
    @Req() req: Request,
  ) {
    const actorId =
      (req.user as { userId?: string } | undefined)?.userId || '';
    return this.usersService.setActive(id, !!body.active, actorId);
  }
}
