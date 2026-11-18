import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { JwtGuard, CurrentUser, AuthUser } from './auth';

@UseGuards(JwtGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private db: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const where = { userId: user.id };
    const [items, unreadCount] = await Promise.all([
      this.db.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 30 }),
      this.db.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return { items, unreadCount };
  }

  @Post('read-all')
  async markAllRead(@CurrentUser() user: AuthUser) {
    const result = await this.db.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true, updated: result.count };
  }

  @Post(':id/read')
  async markRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const result = await this.db.notification.updateMany({
      where: { id, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true, updated: result.count };
  }
}
