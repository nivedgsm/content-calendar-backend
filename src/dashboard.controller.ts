import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser, JwtGuard } from './auth';
import { PrismaService } from './prisma.service';

@UseGuards(JwtGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private db: PrismaService) {}

  @Get('stats')
  async stats(@CurrentUser() user: AuthUser) {
    const clientWhere = {
      agencyId: user.agencyId,
      ...(user.role === 'CLIENT' ? { id: user.clientId || 'none' } : {}),
    };
    const contentWhere = { client: clientWhere };
    const [clients, contentCounts, shoots, recent] = await Promise.all([
      this.db.client.count({ where: clientWhere }),
      this.db.content.groupBy({
        by: ['status'],
        where: contentWhere,
        _count: { _all: true },
      }),
      this.db.shoot.count({ where: { client: clientWhere, date: { gte: new Date() } } }),
      this.db.content.findMany({
        where: contentWhere,
        include: { client: { select: { name: true, color: true } } },
        orderBy: { date: 'asc' },
        take: 6,
      }),
    ]);

    return {
      clients,
      contents: contentCounts.reduce((total, row) => total + row._count._all, 0),
      shoots,
      pending: contentCounts.find(row => row.status === 'FOR_REVIEW')?._count._all ?? 0,
      published: contentCounts.find(row => row.status === 'PUBLISHED')?._count._all ?? 0,
      recent,
    };
  }
}
