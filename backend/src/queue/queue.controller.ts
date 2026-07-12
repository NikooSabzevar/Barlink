import { Controller, Post, Get, Body, Param, Patch, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { QueueService } from './queue.service';
import { IsString, IsNumber, Min, Max, IsIn } from 'class-validator';

class JoinQueueDto {
  @IsNumber()
  @Min(1)
  @Max(20)
  partySize: number;
}

class AdmitDto {
  @IsString()
  qrCode: string;
}

class OverrideDto {
  @IsIn(['reinstate', 'evict'])
  action: 'reinstate' | 'evict';
}

class GpsUpdateDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lon: number;
}

@Controller('queue')
@UseGuards(AuthGuard('jwt'))
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post(':barId/join')
  join(@Param('barId') barId: string, @Request() req: any, @Body() dto: JoinQueueDto) {
    return this.queueService.joinQueue(barId, req.user.id, dto.partySize);
  }

  @Get(':barId/state')
  getState(@Param('barId') barId: string) {
    return this.queueService.getQueueState(barId);
  }

  @Post(':barId/admit')
  admit(@Param('barId') barId: string, @Body() dto: AdmitDto) {
    return this.queueService.admitPatron(dto.qrCode, barId);
  }

  @Patch(':entryId/away')
  markAway(@Param('entryId') entryId: string) {
    return this.queueService.markAway(entryId);
  }

  @Patch(':entryId/exit')
  markExit(@Param('entryId') entryId: string) {
    return this.queueService.markExit(entryId);
  }

  @Patch(':entryId/override')
  override(@Param('entryId') entryId: string, @Body() dto: OverrideDto) {
    return this.queueService.bouncerOverride(entryId, dto.action);
  }

  @Patch(':entryId/gps')
  updateGps(@Param('entryId') entryId: string, @Body() dto: GpsUpdateDto) {
    return this.queueService.updateLastSeen(entryId, dto.lat, dto.lon);
  }

  @Get(':barId/my-entry')
  getMyEntry(@Param('barId') barId: string, @Request() req: any) {
    return this.queueService.getEntryByUser(req.user.id, barId);
  }

  @Post(':barId/simulate-checkin')
  simulateCheckIn(@Param('barId') barId: string, @Request() req: any) {
    if (req.user.role !== 'STAFF' && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Only staff or admins can simulate check-ins');
    }
    return this.queueService.simulateCheckIn(barId);
  }
}
