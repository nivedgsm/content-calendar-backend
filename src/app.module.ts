import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ClientsController } from './clients.controller';
import { ContentController } from './content.controller';
import { ShootsController } from './shoots.controller';
import { DashboardController } from './dashboard.controller';
import { PublicController } from './public.controller';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
@Module({imports:[ConfigModule.forRoot({isGlobal:true})],controllers:[AuthController,ClientsController,ContentController,ShootsController,DashboardController,PublicController,NotificationsController],providers:[PrismaService,AuthService,NotificationsService]}) export class AppModule {}
