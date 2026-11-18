import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get,
  NotFoundException, Param, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { JwtGuard, CurrentUser, AuthUser } from './auth';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtGuard)
@Controller('content')
export class ContentController {
  constructor(private db: PrismaService, private notifications: NotificationsService) {}

  private scope(user: AuthUser) {
    return {
      agencyId: user.agencyId,
      ...(user.role === 'CLIENT' ? { id: user.clientId || 'none' } : {}),
    };
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('clientId') clientId?: string,
    @Query('month') month?: string,
  ) {
    const where: any = { client: this.scope(user) };
    if (clientId && user.role !== 'CLIENT') where.clientId = clientId;
    if (month) {
      const date = new Date(`${month}-01T00:00:00`);
      if (!Number.isNaN(date.getTime())) {
        where.date = { gte: date, lt: new Date(date.getFullYear(), date.getMonth() + 1, 1) };
      }
    }
    return this.db.content.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, color: true } },
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    });
  }

  @Post()
  async create(@Body() body: any, @CurrentUser() user: AuthUser) {
    if (user.role === 'CLIENT') throw new ForbiddenException();
    const client = await this.db.client.findFirst({
      where: { id: body.clientId, agencyId: user.agencyId },
      select: { id: true, name: true },
    });
    if (!client) throw new NotFoundException('Client not found');

    const content = await this.db.content.create({
      data: {
        title: body.title,
        description: body.description,
        caption: body.caption,
        date: new Date(body.date),
        type: body.type,
        platform: body.platform || 'INSTAGRAM',
        status: body.status || 'PLANNED',
        theme: body.theme,
        referenceUrl: body.referenceUrl,
        mediaUrl: body.mediaUrl,
        notes: body.notes,
        clientId: client.id,
        assigneeId: body.assigneeId || null,
      },
    });
    if (content.status === 'FOR_REVIEW') {
      await this.notifications.toClient(client.id, {
        type: 'CONTENT_READY_FOR_REVIEW',
        title: 'Content ready for review',
        message: `${content.title} is ready for your review.`,
        link: '/calendar',
      });
    }
    return content;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    const item = await this.db.content.findFirst({ where: { id, client: this.scope(user) } });
    if (!item) throw new NotFoundException();
    if (user.role === 'CLIENT') throw new ForbiddenException();

    const updated = await this.db.content.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        caption: body.caption,
        date: body.date ? new Date(body.date) : undefined,
        type: body.type,
        platform: body.platform,
        status: body.status,
        theme: body.theme,
        referenceUrl: body.referenceUrl,
        mediaUrl: body.mediaUrl,
        notes: body.notes,
        assigneeId: body.assigneeId,
      },
      include: { client: { select: { name: true } } },
    });
    if (updated.status === 'FOR_REVIEW' && item.status !== 'FOR_REVIEW') {
      await this.notifications.toClient(item.clientId, {
        type: 'CONTENT_READY_FOR_REVIEW',
        title: 'Content ready for review',
        message: `${updated.title} is ready for your review.`,
        link: '/calendar',
      });
    }
    return updated;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    if (user.role === 'CLIENT') throw new ForbiddenException();
    const item = await this.db.content.findFirst({ where: { id, client: this.scope(user) } });
    if (!item) throw new NotFoundException();
    await this.db.content.delete({ where: { id } });
    return { success: true };
  }

  @Post(':id/review')
  async review(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    if (!['CLIENT', 'ADMIN'].includes(user.role)) {
      throw new ForbiddenException('Only clients and admins can review content');
    }
    if (!['APPROVED', 'CHANGES_REQUESTED'].includes(body.status)) {
      throw new BadRequestException('Choose approve or request changes');
    }
    const item = await this.db.content.findFirst({
      where: { id, client: { agencyId: user.agencyId, ...(user.role === 'CLIENT' ? { id: user.clientId || 'none' } : {}) } },
      include: { client: { select: { name: true } } },
    });
    if (!item) throw new NotFoundException();
    if (item.status !== 'FOR_REVIEW') throw new BadRequestException('This content is no longer awaiting review');

    const updated = await this.db.$transaction(async tx => {
      await tx.approval.create({
        data: {
          contentId: id,
          reviewerId: user.id,
          status: body.status,
          comment: typeof body.comment === 'string' ? body.comment.trim() : null,
        },
      });
      return tx.content.update({ where: { id }, data: { status: body.status } });
    });

    const approved = body.status === 'APPROVED';
    const notification = {
      type: approved ? 'CONTENT_APPROVED' : 'CONTENT_CHANGES_REQUESTED',
      title: approved ? 'Content approved' : 'Changes requested',
      message: `${item.title} was ${approved ? 'approved' : 'returned with requested changes'} by ${user.name}.`,
      link: '/calendar',
    };
    if (user.role === 'CLIENT') await this.notifications.toAgency(user.agencyId, notification, user.id);
    else await this.notifications.toClient(item.clientId, notification, user.id);
    return updated;
  }
}
