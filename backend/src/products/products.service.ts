import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma, MovementType } from '@prisma/client'; // <- Import correcto de Decimal

// Helper para convertir Decimal a number
function toNum(value: Prisma.Decimal | number): number {
  return value instanceof Prisma.Decimal ? value.toNumber() : value;
}


@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto) {
    const existingProduct = await this.prisma.product.findUnique({
      where: { code: createProductDto.code },
    });

    if (existingProduct) {
      throw new BadRequestException('El código del producto ya existe');
    }

    return this.prisma.product.create({
      data: createProductDto,
    });
  }

  async findAll(page: number = 1, limit: number = 10, search: string = '') {
    const skip = (page - 1) * limit;
    
    const where: any = {
      OR: [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return product;
  }

  async findByCode(code: string) {
    const product = await this.prisma.product.findUnique({
      where: { code },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    return product;
  }

  async update(id: number, updateProductDto: UpdateProductDto) {
    await this.findOne(id);

    return this.prisma.product.update({
      where: { id },
      data: updateProductDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getLowStockProducts() {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
      },
      orderBy: { stock: 'asc' },
    });

    // Filtrar productos con stock bajo usando toNum
    return products.filter(product => toNum(product.stock) <= toNum(product.minStock));
  }

  async getCostOptions(productId: number) {
    const details = await this.prisma.movementDetail.findMany({
      where: {
        productId,
        movement: { type: MovementType.ENTRADA },
      },
      include: {
        movement: { select: { date: true } },
      },
      orderBy: { movement: { date: 'desc' } },
    });

    const seen = new Set<string>();
    const options: { unitCost: number; lastUsed: Date }[] = [];
    for (const detail of details) {
      const cost = toNum(detail.unitCost);
      const key = String(cost);
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({ unitCost: cost, lastUsed: detail.movement.date });
    }

    return options;
  }

  async updateStock(productId: number, quantity: number, type: 'INCREMENT' | 'DECREMENT') {
    const product = await this.findOne(productId);

    const currentStock = toNum(product.stock);
    const newStock =
      type === 'INCREMENT'
        ? currentStock + quantity
        : currentStock - quantity;

    if (newStock < 0) {
      throw new BadRequestException('Stock insuficiente');
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: { stock: newStock },
    });
  }
}
