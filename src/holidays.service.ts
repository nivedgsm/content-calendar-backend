import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateHolidayDto, UpdateHolidayDto } from './holidays.dto';

@Injectable()
export class HolidaysService {
  constructor(private readonly db: PrismaService) {}

  list(agencyId: string, month?: string) {
    let dateFilter = {};
    if (month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      const [year, monthNumber] = month.split('-').map(Number);
      dateFilter = {
        date: {
          gte: new Date(Date.UTC(year, monthNumber - 1, 1)),
          lt: new Date(Date.UTC(year, monthNumber, 1)),
        },
      };
    }
    return this.db.agencyHoliday.findMany({
      where: { agencyId, ...dateFilter },
      orderBy: { date: 'asc' },
    });
  }

  create(agencyId: string, body: CreateHolidayDto) {
    return this.db.agencyHoliday.create({
      data: {
        agencyId,
        title: body.title,
        date: new Date(body.date),
        description: body.description || null,
      },
    });
  }

  update(id: string, agencyId: string, body: UpdateHolidayDto) {
    return this.db.agencyHoliday.updateMany({
      where: { id, agencyId },
      data: {
        title: body.title,
        date: body.date ? new Date(body.date) : undefined,
        description: body.description === undefined ? undefined : body.description || null,
      },
    });
  }

  delete(id: string, agencyId: string) {
    return this.db.agencyHoliday.deleteMany({ where: { id, agencyId } });
  }
}
