import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { UserStreakService } from './services/user-streak.service';
import { UserStreakController } from './controllers/user-streak.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UserStreakController],
  providers: [UserStreakService],
  exports: [UserStreakService],
})
export class UserStreakModule {}
