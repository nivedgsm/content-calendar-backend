import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { JwtGuard, CurrentUser, AuthUser } from './auth';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtGuard)
@Controller('shoots')
export class ShootsController {
  constructor(private db: PrismaService, private notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query('clientId') clientId?: string) {
    return this.db.shoot.findMany({
      where: { client: { agencyId: u.agencyId, ...(u.role === 'CLIENT' ? { id: u.clientId || 'none' } : {}) }, ...(clientId && u.role !== 'CLIENT' ? { clientId } : {}) },
      include: { client: { select: { id: true, name: true, color: true } } }, orderBy: { date: 'asc' },
    });
  }

  @Post()
  async create(@Body() b: any, @CurrentUser() u: AuthUser) {
    if (u.role === 'CLIENT') throw new ForbiddenException();
    const client = await this.db.client.findFirst({ where: { id: b.clientId, agencyId: u.agencyId }, select: { id: true } });
    if (!client) throw new NotFoundException('Client not found');
    const shoot = await this.db.shoot.create({ data: { title: b.title, date: new Date(b.date), startTime: b.startTime || null, endTime: b.endTime || null, location: b.location, crew: b.crew, shotList: b.shotList, notes: b.notes, clientId: client.id } });
    await this.notifications.toClient(client.id, {
      type: 'SHOOT_SCHEDULED',
      title: 'New shoot scheduled',
      message: `${shoot.title} has been scheduled.`,
      link: '/shoots',
    });
    return shoot;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() b: any, @CurrentUser() u: AuthUser) {
    if (u.role === 'CLIENT') throw new ForbiddenException();
    const s = await this.db.shoot.findFirst({ where: { id, client: { agencyId: u.agencyId } } });
    if (!s) throw new NotFoundException();
    const shoot = await this.db.shoot.update({ where: { id }, data: { title: b.title, date: b.date ? new Date(b.date) : undefined, startTime: b.startTime === '' ? null : b.startTime, endTime: b.endTime === '' ? null : b.endTime, location: b.location, crew: b.crew, shotList: b.shotList, notes: b.notes } });
    await this.notifications.toClient(s.clientId, {
      type: 'SHOOT_UPDATED',
      title: 'Shoot schedule updated',
      message: `${shoot.title} has been updated.`,
      link: '/shoots',
    });
    return shoot;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    if (u.role !== 'ADMIN') throw new ForbiddenException();
    const shoot = await this.db.shoot.findFirst({ where: { id, client: { agencyId: u.agencyId } } });
    if (!shoot) return { success: true };
    await this.db.shoot.delete({ where: { id } });
    await this.notifications.toClient(shoot.clientId, {
      type: 'SHOOT_CANCELLED',
      title: 'Shoot cancelled',
      message: `${shoot.title} has been removed from the schedule.`,
      link: '/shoots',
    });
    return { success: true };
  }
}
