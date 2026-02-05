import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsBoolean, Min } from 'class-validator';
import { UnitType } from '@prisma/client';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(UnitType)
  unit: UnitType;

  @IsNumber()
  @Min(0)
  unitCost: number;

  @IsNumber()
  @Min(0)
  minStock: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxStock?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}