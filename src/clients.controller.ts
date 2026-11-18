import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthUser, CurrentUser, JwtGuard } from './auth';
import { AuthService } from './auth.service';
import { InviteClientDto } from './auth.dto';
import { PrismaService } from './prisma.service';

@UseGuards(JwtGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly db: PrismaService, private readonly auth: AuthService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return this.db.client.findMany({
      where: { agencyId: user.agencyId, ...(user.role === 'CLIENT' ? { id: user.clientId || 'none' } : {}) },
      include: { _count: { select: { contents: true, shoots: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  async create(@Body() body: any, @CurrentUser() user: AuthUser) {
    if (user.role === 'CLIENT') throw new ForbiddenException();
    return this.db.client.create({
      data: {
        name: body.name,
        brandName: body.brandName,
        industry: body.industry,
        email: body.email,
        phone: body.phone,
        color: body.color || '#7567F8',
        notes: body.notes,
        agencyId: user.agencyId,
      },
    });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: AuthUser) {
    if (user.role === 'CLIENT') throw new ForbiddenException('Client accounts cannot edit client records');
    const client = await this.db.client.findFirst({ where: { id, agencyId: user.agencyId } });
    if (!client) throw new NotFoundException();
    return this.db.client.update({
      where: { id },
      data: {
        name: body.name,
        brandName: body.brandName,
        industry: body.industry,
        email: body.email,
        phone: body.phone,
        color: body.color,
        notes: body.notes,
      },
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    if (user.role !== 'ADMIN') throw new ForbiddenException();
    await this.db.client.deleteMany({ where: { id, agencyId: user.agencyId } });
    return { success: true };
  }

  @Post(':id/invite')
  async invite(@Param('id') id: string, @Body() body: InviteClientDto, @CurrentUser() user: AuthUser) {
    if (user.role !== 'ADMIN') throw new ForbiddenException();
    const client = await this.db.client.findFirst({ where: { id, agencyId: user.agencyId } });
    if (!client) throw new NotFoundException();
    return this.auth.createClientAccount({
      name: typeof body.name === 'string' && body.name.trim() ? body.name : client.name,
      email: body.email,
      password: body.password,
      agencyId: user.agencyId,
      clientId: client.id,
    });
  }

  @Post(':id/share')
  async share(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    if (user.role === 'CLIENT') throw new ForbiddenException('Client accounts cannot create share links');
    const client = await this.db.client.findFirst({ where: { id, agencyId: user.agencyId } });
    if (!client) throw new NotFoundException();
    return this.db.client.update({ where: { id }, data: { shareToken: client.shareToken || randomUUID() } });
  }
}
