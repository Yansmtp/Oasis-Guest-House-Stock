import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { CurrenciesService } from './currencies.service';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';

@Controller('currencies')
@UseGuards(JwtAuthGuard)
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Get()
  async findAll() {
    const list = await this.currenciesService.getAll();
    return { data: list };
  }

  @Patch(':code')
  async update(@Param('code') code: string, @Body() body: { rate?: number; isDefault?: boolean }) {
    let updated: any = null;
    if (typeof body.rate === 'number') {
      updated = await this.currenciesService.updateRate(code, body.rate);
    }
    if (body.isDefault) {
      updated = await this.currenciesService.setDefault(code);
    }
    return { data: updated };
  }
}
