import { Module } from '@nestjs/common';
import { UsersModule } from './lib/users.module';

@Module({
  imports: [UsersModule],
})
export class UsersModule {}
