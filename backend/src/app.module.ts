// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SharedModule } from './shared/shared.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { ClientsModule } from './clients/clients.module';
import { CostCentersModule } from './cost-centers/cost-centers.module';
import { MovementsModule } from './movements/movements.module';
import { ReportsModule } from './reports/reports.module';
import { CompanyModule } from './company/company.module';
import { CurrenciesModule } from './currencies/currencies.module';
import { MaintenanceModule } from './maintenance/maintenance.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    SharedModule,     // contiene PrismaModule
    AuthModule,
    ProductsModule,
    ClientsModule,
    CostCentersModule,
    MovementsModule,
    ReportsModule,
    CompanyModule,
    // Currencies (file-based simple settings)
    CurrenciesModule,
    MaintenanceModule,
    UsersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
