import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
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

@UseGuards(JwtGuard)
@Controller('marketing-performance')
export class MarketingPerformanceController {
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

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('clientId') clientId?: string,
    @Query('month') month?: string,
  ) {
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

    return this.db.marketingActivity.findMany({
      where,
      include: { client: { select: { id: true, name: true, color: true } } },
      orderBy: { uploadedAt: 'desc' },
    });
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
    return this.images.upload(file.buffer, file.mimetype);
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
        takenDownAt: body.takenDownAt ? new Date(body.takenDownAt) : null,
        imageUrl: body.imageUrl || null,
        imagePublicId: body.imagePublicId || null,
        notes: body.notes || null,
      },
      include: { client: { select: { id: true, name: true, color: true } } },
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
        takenDownAt: body.takenDownAt === undefined ? undefined : nextTakenDownDate,
        imageUrl: body.imageUrl === undefined ? undefined : body.imageUrl || null,
        imagePublicId: body.imagePublicId === undefined ? undefined : body.imagePublicId || null,
        notes: body.notes === undefined ? undefined : body.notes || null,
      },
      include: { client: { select: { id: true, name: true, color: true } } },
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    this.assertStaff(user);
    const activity = await this.db.marketingActivity.findFirst({
      where: { id, client: { agencyId: user.agencyId } },
    });
    if (!activity) throw new NotFoundException();
    if (activity.imagePublicId) await this.images.delete(activity.imagePublicId);
    await this.db.marketingActivity.delete({ where: { id } });
    return { success: true };
  }
}
