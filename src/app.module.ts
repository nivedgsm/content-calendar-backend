import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ClientsController } from './clients.controller';
import { ContentController } from './content.controller';
import { ShootsController } from './shoots.controller';
import { DashboardController } from './dashboard.controller';
import { PublicController } from './public.controller';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { validateEnvironment } from './env.validation';
import { MarketingPerformanceController } from './marketing-performance.controller';
import { MarketingImageService } from './marketing-image.service';
import { HolidaysModule } from './holidays.module';
import { PrismaModule } from './prisma.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }), PrismaModule, HolidaysModule],
  controllers: [AuthController, ClientsController, ContentController, ShootsController, DashboardController, PublicController, NotificationsController, MarketingPerformanceController],
  providers: [AuthService, NotificationsService, MarketingImageService],
})
export class AppModule {}

