import { IsString, IsEnum, IsOptional, IsArray, ValidateNested, IsDateString, IsUUID, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MovementType } from '@prisma/client';

export class MovementDetailDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

export class CreateMovementDto {
  @IsEnum(MovementType)
  type: MovementType;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MovementDetailDto)
  details: MovementDetailDto[];
}