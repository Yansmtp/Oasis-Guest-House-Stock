import { Controller, Get, Query, Param, UseGuards, Res, BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { Response } from 'express';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  private parseRequiredDate(value?: string, fieldName: string = 'date') {
    if (!value) {
      throw new BadRequestException(`${fieldName} es obligatorio`);
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`${fieldName} no es una fecha valida`);
    }
    return d;
  }

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

  @Get('movements/export')
  async exportMovementsReportExcel(
    @Res() res: Response,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('currency') currency?: string,
    @Query('type') type?: string,
    @Query('clientId') clientId?: string,
    @Query('costCenterId') costCenterId?: string,
  ) {
    const start = this.parseRequiredDate(startDate, 'startDate');
    const end = this.parseRequiredDate(endDate, 'endDate');
    end.setHours(23, 59, 59, 999);

    const exportFile = await this.reportsService.exportMovementsReportExcel({
      startDate: start,
      endDate: end,
      currency: currency || 'USD',
      type: type as any,
      clientId: clientId ? parseInt(clientId, 10) : undefined,
      costCenterId: costCenterId ? parseInt(costCenterId, 10) : undefined,
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFile.filename}"`);
    res.send(exportFile.buffer);
  }

  @Get('movements/invoice-export')
  async exportMovementsInvoiceExcel(
    @Res() res: Response,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('currency') currency?: string,
    @Query('type') type?: string,
    @Query('clientId') clientId?: string,
    @Query('costCenterId') costCenterId?: string,
    @Query('invoiceNumber') invoiceNumber?: string,
  ) {
    const start = this.parseRequiredDate(startDate, 'startDate');
    const end = this.parseRequiredDate(endDate, 'endDate');
    end.setHours(23, 59, 59, 999);

    const exportFile = await this.reportsService.exportMovementsInvoiceExcel({
      startDate: start,
      endDate: end,
      currency: currency || 'USD',
      type: type as any,
      clientId: clientId ? parseInt(clientId, 10) : undefined,
      costCenterId: costCenterId ? parseInt(costCenterId, 10) : undefined,
      invoiceNumber,
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFile.filename}"`);
    res.send(exportFile.buffer);
  }
}
