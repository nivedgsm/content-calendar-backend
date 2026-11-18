import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export type NotificationPayload = {
  type: string;
  title: string;
  message: string;
  link?: string;
};

@Injectable()
export class NotificationsService {
  constructor(private db: PrismaService) {}

  async toClient(clientId: string, payload: NotificationPayload, excludeUserId?: string) {
    try {
      const users = await this.db.user.findMany({
        where: { clientId, role: 'CLIENT', ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
        select: { id: true },
      });
      await this.createForUsers(users.map(user => user.id), payload);
    } catch (error) {
      console.error('[notifications] Could not find client recipients', error);
    }
  }

  async toAgency(agencyId: string, payload: NotificationPayload, excludeUserId?: string) {
    try {
      const users = await this.db.user.findMany({
        where: {
          agencyId,
          role: { in: ['ADMIN', 'TEAM_MEMBER'] },
          ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
        },
        select: { id: true },
      });
      await this.createForUsers(users.map(user => user.id), payload);
    } catch (error) {
      console.error('[notifications] Could not find agency recipients', error);
    }
  }

  private async createForUsers(userIds: string[], payload: NotificationPayload) {
    if (!userIds.length) return;
    try {
      await this.db.notification.createMany({
        data: userIds.map(userId => ({ ...payload, userId })),
      });
    } catch (error) {
      // A notification failure should not roll back a content or scheduling action.
      console.error('[notifications] Could not persist notifications', error);
    }
  }
}
