import { Controller, Post, UseGuards, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { MaintenanceService } from './maintenance.service';

@Controller('maintenance')
@UseGuards(JwtAuthGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post('backup')
  backup() {
    return this.maintenanceService.backup();
  }

  @Post('reset')
  reset(@Body() body: { confirm?: string }) {
    if (body?.confirm !== 'RESET') {
      return { ok: false, message: 'Confirmación requerida' };
    }
    return this.maintenanceService.reset();
  }
}
