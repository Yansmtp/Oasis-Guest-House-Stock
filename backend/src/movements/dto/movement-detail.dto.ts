import { IsNumber, IsPositive, Min } from 'class-validator';

export class MovementDetailDto {
  @IsNumber()
  productId: number;

  @IsNumber()
  @IsPositive()
  @Min(0.01)
  quantity: number;

  @IsNumber()
  @IsPositive()
  @Min(0)
  unitCost: number;
}