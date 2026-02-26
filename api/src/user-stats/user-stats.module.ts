import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { UserStatsService } from './services/user-stats.service';
import { UserStatsController } from './controllers/user-stats.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UserStatsController],
  providers: [UserStatsService],
  exports: [UserStatsService],
})
export class UserStatsModule {}
