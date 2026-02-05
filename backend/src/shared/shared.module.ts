// backend/src/shared/shared.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  exports: [PrismaModule],  // reexporta PrismaService si alguien importa SharedModule
})
export class SharedModule {}
