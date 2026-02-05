import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('stock')
  getStockReport(@Query('currency') currency?: string) {
    return this.reportsService.getStockReport(currency || 'USD');
  }

  @Get('client/:id')
  getClientReport(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('currency') currency?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    
    return this.reportsService.getClientReport(+id, start, end, currency || 'USD');
  }

  @Get('cost-center/:id')
  getCostCenterReport(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('currency') currency?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    
    return this.reportsService.getCostCenterReport(+id, start, end, currency || 'USD');
  }

  @Get('product/:id/history')
  getProductMovementHistory(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    
    return this.reportsService.getProductMovementHistory(+id, start, end);
  }
}
