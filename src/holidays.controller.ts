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
  UseGuards,
} from '@nestjs/common';
import { AuthUser, CurrentUser, JwtGuard } from './auth';
import { CreateHolidayDto, UpdateHolidayDto } from './holidays.dto';
import { HolidaysService } from './holidays.service';

@UseGuards(JwtGuard)
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidays: HolidaysService) {}

  private assertAgencyUser(user: AuthUser) {
    if (user.role === 'CLIENT') {
      throw new ForbiddenException('Agency holidays are not available to client accounts.');
    }
  }

  private assertAdmin(user: AuthUser) {
    if (user.role !== 'ADMIN') throw new ForbiddenException('Only agency admins can manage holidays.');
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('month') month?: string) {
    this.assertAgencyUser(user);
    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new BadRequestException('Month must use YYYY-MM format.');
    }
    return this.holidays.list(user.agencyId, month);
  }

  @Post()
  create(@Body() body: CreateHolidayDto, @CurrentUser() user: AuthUser) {
    this.assertAdmin(user);
    return this.holidays.create(user.agencyId, body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdateHolidayDto, @CurrentUser() user: AuthUser) {
    this.assertAdmin(user);
    const result = await this.holidays.update(id, user.agencyId, body);
    if (!result.count) throw new NotFoundException('Holiday not found.');
    return { success: true };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    this.assertAdmin(user);
    const result = await this.holidays.delete(id, user.agencyId);
    if (!result.count) throw new NotFoundException('Holiday not found.');
    return { success: true };
  }
}
