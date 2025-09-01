import { Module } from '@nestjs/common';
import { AppEspnLinesMonoApiModule } from '../index';

@Module({
  imports: [AppEspnLinesMonoApiModule],
})
export class AppModule {}
