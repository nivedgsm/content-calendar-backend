import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  ServiceUnavailableException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { AuthUser, CurrentUser, JwtGuard } from './auth';
import { CreateMarketingActivityDto, UpdateMarketingActivityDto } from './marketing-performance.dto';
import { MarketingImageService } from './marketing-image.service';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const activityInclude = {
  client: { select: { id: true, name: true, color: true } },
  images: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.MarketingActivityInclude;

@UseGuards(JwtGuard)
@Controller('marketing-performance')
export class MarketingPerformanceController {
  private readonly logger = new Logger(MarketingPerformanceController.name);
  constructor(private readonly db: PrismaService, private readonly images: MarketingImageService) {}

  private assertStaff(user: AuthUser): void {
    if (user.role === 'CLIENT') throw new ForbiddenException('Client accounts can only view marketing performance.');
  }

  private clientScope(user: AuthUser) {
    return {
      agencyId: user.agencyId,
      ...(user.role === 'CLIENT' ? { id: user.clientId || 'none' } : {}),
    };
  }

  private activityScope(user: AuthUser, month?: string, clientId?: string) {
    const where: Prisma.MarketingActivityWhereInput = {
      client: this.clientScope(user),
      ...(clientId && user.role !== 'CLIENT' ? { clientId } : {}),
    };

    if (month) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('Month must use YYYY-MM format.');
      const [year, monthNumber] = month.split('-').map(Number);
      const start = new Date(Date.UTC(year, monthNumber - 1, 1));
      const end = new Date(Date.UTC(year, monthNumber, 1));
      where.OR = [
        { uploadedAt: { gte: start, lt: end } },
        { takenDownAt: { gte: start, lt: end } },
        { uploadedAt: { lt: end }, takenDownAt: null },
        { uploadedAt: { lt: start }, takenDownAt: { gte: start } },
      ];
    }

    return where;
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('clientId') clientId?: string,
    @Query('month') month?: string,
    @Query('limit') limit?: string,
  ) {
    if (limit !== undefined && !/^(?:[1-9]|[1-4]\d|50)$/.test(limit)) {
      throw new BadRequestException('Limit must be an integer from 1 to 50.');
    }
    return this.db.marketingActivity.findMany({
      where: this.activityScope(user, month, clientId),
      include: activityInclude,
      orderBy: { uploadedAt: 'desc' },
      take: limit === undefined ? undefined : Number(limit),
    });
  }

  @Get('summary')
  async summary(@CurrentUser() user: AuthUser, @Query('month') month: string) {
    if (!month) throw new BadRequestException('Month must use YYYY-MM format.');
    const where = this.activityScope(user, month);
    const now = new Date();
    const [spend, activeCampaigns] = await Promise.all([
      this.db.marketingActivity.aggregate({ where, _sum: { spendRupees: true } }),
      this.db.marketingActivity.count({
        where: {
          AND: [where, {
            uploadedAt: { lte: now },
            OR: [{ takenDownAt: null }, { takenDownAt: { gt: now } }],
          }],
        },
      }),
    ]);
    return { activeCampaigns, spendRupees: spend._sum.spendRupees ?? 0 };
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('image', {
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    fileFilter: (_request, file, callback) => {
      if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
        callback(new BadRequestException('Upload a JPEG, PNG, WebP, or GIF image.') as any, false);
        return;
      }
      callback(null, true);
    },
  }))
  async uploadImage(@UploadedFile() file: any, @CurrentUser() user: AuthUser) {
    this.assertStaff(user);
    if (!file?.buffer) throw new BadRequestException('Choose an image to upload.');
    if (file.size > MAX_IMAGE_BYTES) throw new BadRequestException('Image must be 4 MB or smaller.');
    if (!IMAGE_MIME_TYPES.has(file.mimetype)) throw new BadRequestException('Upload a JPEG, PNG, WebP, or GIF image.');
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      throw new ServiceUnavailableException('Image uploads are not configured for this API.');
    }
    return this.images.upload(file.buffer, file.mimetype, user.agencyId);
  }

  @Post()
  async create(@Body() body: CreateMarketingActivityDto, @CurrentUser() user: AuthUser) {
    this.assertStaff(user);
    const client = await this.db.client.findFirst({
      where: { id: body.clientId, agencyId: user.agencyId },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Client not found.');
    if (body.takenDownAt && new Date(body.takenDownAt) < new Date(body.uploadedAt)) {
      throw new BadRequestException('Taken-down date must be on or after the upload date.');
    }

    return this.db.marketingActivity.create({
      data: {
        clientId: client.id,
        creativeName: body.creativeName,
        platform: body.platform || 'META',
        uploadedAt: new Date(body.uploadedAt),
        spendRupees: new Prisma.Decimal(body.spendRupees),
        totalImpressions: body.totalImpressions,
        totalReach: body.totalReach,
        totalResult: body.totalResult,
        costPerResult: body.costPerResult,
        location: body.location || null,
        showDailySpendToClient: body.showDailySpendToClient,
        takenDownAt: body.takenDownAt ? new Date(body.takenDownAt) : null,
        imageUrl: body.imageUrl || null,
        imagePublicId: body.imagePublicId || null,
        images: body.images?.length ? { createMany: { data: body.images, skipDuplicates: true } } : undefined,
        notes: body.notes || null,
      },
      include: activityInclude,
    });
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateMarketingActivityDto,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertStaff(user);
    const current = await this.db.marketingActivity.findFirst({
      where: { id, client: { agencyId: user.agencyId } },
    });
    if (!current) throw new NotFoundException();

    let nextClientId = current.clientId;
    if (body.clientId && body.clientId !== current.clientId) {
      const client = await this.db.client.findFirst({
        where: { id: body.clientId, agencyId: user.agencyId },
        select: { id: true },
      });
      if (!client) throw new NotFoundException('Client not found.');
      nextClientId = client.id;
    }

    const nextUploadDate = body.uploadedAt ? new Date(body.uploadedAt) : current.uploadedAt;
    const nextTakenDownDate = body.takenDownAt === undefined
      ? current.takenDownAt
      : body.takenDownAt ? new Date(body.takenDownAt) : null;
    if (nextTakenDownDate && nextTakenDownDate < nextUploadDate) {
      throw new BadRequestException('Taken-down date must be on or after the upload date.');
    }

    return this.db.marketingActivity.update({
      where: { id },
      data: {
        clientId: nextClientId,
        creativeName: body.creativeName,
        platform: body.platform,
        uploadedAt: body.uploadedAt ? nextUploadDate : undefined,
        spendRupees: body.spendRupees === undefined ? undefined : new Prisma.Decimal(body.spendRupees),
        totalImpressions: body.totalImpressions,
        totalReach: body.totalReach,
        totalResult: body.totalResult,
        costPerResult: body.costPerResult,
        location: body.location === undefined ? undefined : body.location || null,
        showDailySpendToClient: body.showDailySpendToClient,
        takenDownAt: body.takenDownAt === undefined ? undefined : nextTakenDownDate,
        imageUrl: body.imageUrl === undefined ? undefined : body.imageUrl || null,
        imagePublicId: body.imagePublicId === undefined ? undefined : body.imagePublicId || null,
        images: body.images?.length ? { createMany: { data: body.images, skipDuplicates: true } } : undefined,
        notes: body.notes === undefined ? undefined : body.notes || null,
      },
      include: activityInclude,
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    this.assertStaff(user);
    const activity = await this.db.marketingActivity.delete({
      where: { id, client: { agencyId: user.agencyId } },
      include: { images: true },
    }).catch(error => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException();
      }
      throw error;
    });
    const prefix = `contentflow/marketing-performance/${user.agencyId}/`;
    const publicIds = new Set([
      activity.imagePublicId,
      ...activity.images.map(image => image.imagePublicId?.startsWith(prefix) ? image.imagePublicId : null),
    ]);
    for (const publicId of publicIds) {
      if (!publicId) continue;
      await this.images.delete(publicId).catch(() => this.logger.warn('Could not remove an image from storage.'));
    }
    return { success: true };
  }
}
