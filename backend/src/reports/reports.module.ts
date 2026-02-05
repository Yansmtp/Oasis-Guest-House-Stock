import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { MovementsModule } from '../movements/movements.module';
import { ProductsModule } from '../products/products.module';
import { CurrenciesModule } from '../currencies/currencies.module';

@Module({
  imports: [MovementsModule, ProductsModule, CurrenciesModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
