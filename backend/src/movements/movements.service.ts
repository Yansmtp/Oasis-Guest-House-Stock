import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { CurrenciesService } from '../currencies/currencies.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { MovementDetailDto } from './dto/movement-detail.dto';
import { MovementType, Prisma } from '@prisma/client';

// Helper para convertir Decimal a number
function toNum(value: Prisma.Decimal | number): number {
  return value instanceof Prisma.Decimal ? value.toNumber() : value;
}

@Injectable()
export class MovementsService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
    private currenciesService: CurrenciesService,
  ) {}

  // ---------------------------
  // Métodos requeridos por el controller
  // ---------------------------

  // Normaliza tipos numéricos de detalles y productos para que el frontend reciba numbers
  private normalizeMovement(movement: any) {
    if (!movement) return movement;
    const m: any = { ...movement };

    if (m.details && Array.isArray(m.details)) {
      m.details = m.details.map((d: any) => ({
        ...d,
        quantity: toNum(d.quantity),
        unitCost: toNum(d.unitCost),
        totalCost: toNum(d.totalCost),
        product: d.product ? {
          ...d.product,
          stock: toNum(d.product.stock),
          unitCost: toNum(d.product.unitCost),
        } : d.product,
      }));
    }

    // Normalizar producto en caso de que exista en la raíz (compatibilidad)
    if (m.product) {
      m.product = {
        ...m.product,
        stock: toNum(m.product.stock),
        unitCost: toNum(m.product.unitCost),
      };
    }

    // Normalizar tasa almacenada
    if (m.rateAtTransaction !== undefined) {
      m.rateAtTransaction = toNum(m.rateAtTransaction);
    }

    return m;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    startDate?: Date,
    endDate?: Date,
    clientId?: number,
    costCenterId?: number
  ) {
    const skip = (page - 1) * limit;

    const where: any = {
      AND: [
        search ? {
          OR: [
            { documentNumber: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ]
        } : undefined,
        startDate || endDate ? {
          date: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          }
        } : undefined,
        clientId ? { clientId } : undefined,
        costCenterId ? { costCenterId } : undefined,
      ].filter(Boolean),
    };

    const [movements, total] = await Promise.all([
      this.prisma.movement.findMany({
        where,
        skip,
        take: limit,
        include: { client: true, costCenter: true, details: { include: { product: true } } },
        orderBy: { date: 'desc' },
      }),
      this.prisma.movement.count({ where }),
    ]);

    const normalized = movements.map(m => this.normalizeMovement(m));

    return {
      data: normalized,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const movement = await this.prisma.movement.findUnique({
      where: { id },
      include: {
        client: true,
        costCenter: true,
        details: { include: { product: true } },
      },
    });

    if (!movement) {
      throw new NotFoundException('Movimiento no encontrado');
    }

    return this.normalizeMovement(movement);
  }

  // ---------------------------
  // Crear un movimiento
  // ---------------------------
  async create(userId: number, createMovementDto: CreateMovementDto) {
    if (!createMovementDto.clientId && !createMovementDto.costCenterId) {
      throw new BadRequestException('Debe especificar un cliente o un centro de costo');
    }

    if (!createMovementDto.details || createMovementDto.details.length === 0) {
      throw new BadRequestException('Debe agregar al menos un producto');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Determinar moneda y tasa al momento de la transacción
      let currencyCode = createMovementDto.currencyCode
        || (await this.currenciesService.getAll()).find(c => c.isDefault)?.code
        || 'USD';
      let rateAtTransaction = 1;

      if (createMovementDto.type === MovementType.SALIDA) {
        currencyCode = 'USD';
        rateAtTransaction = 1;
      } else {
        const currencyEntry = await this.currenciesService.get(currencyCode);
        rateAtTransaction = currencyEntry ? currencyEntry.rate : 1;
      }

      const movement = await tx.movement.create({
        data: {
          type: createMovementDto.type,
          date: createMovementDto.date || new Date(),
          documentNumber: createMovementDto.documentNumber,
          description: createMovementDto.description,
          clientId: createMovementDto.clientId,
          costCenterId: createMovementDto.costCenterId,
          userId: userId,
          currencyCode,
          rateAtTransaction,
        },
      });

      const details = [];
      let totalMovement = 0;

      for (const detailDto of createMovementDto.details) {
        const product = await tx.product.findUnique({
          where: { id: detailDto.productId },
        });

        if (!product) {
          throw new NotFoundException(`Producto con ID ${detailDto.productId} no encontrado`);
        }

        // Validar stock para salidas
        if (createMovementDto.type === MovementType.SALIDA && toNum(product.stock) < detailDto.quantity) {
          throw new BadRequestException(
            `Stock insuficiente para ${product.name}. Stock actual: ${toNum(product.stock)}, requerido: ${detailDto.quantity}`
          );
        }

        const unitCostInput = toNum(detailDto.unitCost);
        const unitCostToUse = createMovementDto.type === MovementType.SALIDA
          ? toNum(product.unitCost)
          : unitCostInput;

        const totalCost = detailDto.quantity * unitCostToUse;
        totalMovement += totalCost;

        const detail = await tx.movementDetail.create({
          data: {
            movementId: movement.id,
            productId: detailDto.productId,
            quantity: detailDto.quantity,
            unitCost: unitCostToUse,
            totalCost: totalCost,
          },
        });

        // Actualizar stock del producto
        if (createMovementDto.type === MovementType.ENTRADA) {
          const currentStock = toNum(product.stock);
          const currentCost = toNum(product.unitCost);
          const qty = detailDto.quantity;
          const unitCost = toNum(detailDto.unitCost);
          const unitCostUsd = currencyCode === 'USD' ? unitCost : unitCost * rateAtTransaction;
          const newStock = currentStock + qty;
          const newCost =
            newStock > 0 ? ((currentStock * currentCost) + (qty * unitCostUsd)) / newStock : unitCostUsd;

          await tx.product.update({
            where: { id: detailDto.productId },
            data: {
              stock: { increment: qty },
              unitCost: newCost,
            },
          });
        } else {
          await tx.product.update({
            where: { id: detailDto.productId },
            data: {
              stock: { increment: -detailDto.quantity },
            },
          });
        }

        details.push(detail);
      }

      return {
        ...movement,
        details,
        total: totalMovement,
      };
    });
  }

  // ---------------------------
  // Reportes
  // ---------------------------
  async getInventoryReport() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    const totalValue = products.reduce((sum, product) => {
      return sum + toNum(product.stock) * toNum(product.unitCost);
    }, 0);

    const lowStockProducts = products.filter(
      product => toNum(product.stock) <= toNum(product.minStock)
    );

    return {
      products,
      summary: {
        totalProducts: products.length,
        totalValue,
        lowStockCount: lowStockProducts.length,
      },
      lowStockProducts,
    };
  }

  async getMovementsReport(startDate: Date, endDate: Date, targetCurrency: string = 'USD') {
    const movements = await this.prisma.movement.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        client: true,
        costCenter: true,
        details: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    const summary = {
      totalEntries: 0,
      totalExits: 0,
      totalEntriesValue: 0,
      totalExitsValue: 0,
      products: {} as Record<number, any>,
      currency: targetCurrency,
    };

    const rateCache = new Map<string, number>();
    const movementTotals = new Map<number, number>();
    const getRateAt = async (code: string, at: Date) => {
      if (code === 'USD') return 1;
      const key = `${code}|${at.toISOString()}`;
      if (!rateCache.has(key)) {
        const rate = await this.currenciesService.getRateAt(code, at);
        rateCache.set(key, rate);
      }
      return rateCache.get(key)!;
    };

    const convertToTarget = async (movement: any, amount: number) => {
      if (targetCurrency === movement.currencyCode) return amount;
      const rateAtTransaction = toNum(movement.rateAtTransaction || 1);
      const amountUsd = movement.currencyCode === 'USD' ? amount : amount * rateAtTransaction;
      if (targetCurrency === 'USD') return amountUsd;
      const targetRate = await getRateAt(targetCurrency, movement.date);
      return targetRate ? amountUsd / targetRate : amountUsd;
    };

    for (const movement of movements) {
      const isEntry = movement.type === MovementType.ENTRADA;
      
      if (isEntry) summary.totalEntries++;
      else summary.totalExits++;

      for (const detail of movement.details) {
        const productId = detail.productId;
        const value = toNum(detail.totalCost);
        const valueBase = await convertToTarget(movement, value);
        movementTotals.set(movement.id, (movementTotals.get(movement.id) || 0) + valueBase);

        if (isEntry) summary.totalEntriesValue += valueBase;
        else summary.totalExitsValue += valueBase;

        if (!summary.products[productId]) {
          summary.products[productId] = {
            product: detail.product,
            entries: 0,
            exits: 0,
            entriesValue: 0,
            exitsValue: 0,
          };
        }

        if (isEntry) {
          summary.products[productId].entries += detail.quantity;
          summary.products[productId].entriesValue += valueBase;
        } else {
          summary.products[productId].exits += detail.quantity;
          summary.products[productId].exitsValue += valueBase;
        }
      }
    }

    const normalizedMovements = movements.map(m => ({
      ...this.normalizeMovement(m),
      reportTotal: movementTotals.get(m.id) || 0,
      reportCurrency: targetCurrency,
    }));

    return { movements: normalizedMovements, summary };
  }

  async generateVoucher(movementId: number) {
    const movement = await this.prisma.movement.findUnique({
      where: { id: movementId },
      include: {
        client: true,
        costCenter: true,
        user: { select: { name: true, email: true } },
        details: { include: { product: true } },
      },
    });

    if (!movement) {
      throw new NotFoundException('Movimiento no encontrado');
    }

    const voucher = {
      id: movement.id,
      type: movement.type,
      date: movement.date,
      documentNumber: movement.documentNumber,
      description: movement.description,
      client: movement.client,
      costCenter: movement.costCenter,
      user: movement.user,
      currencyCode: movement.currencyCode,
      rateAtTransaction: toNum(movement.rateAtTransaction || 1),
      details: movement.details.map(detail => ({
        code: detail.product.code,
        product: detail.product.name,
        unit: detail.product.unit,
        quantity: detail.quantity,
        unitCost: toNum(detail.unitCost),
        totalCost: toNum(detail.totalCost),
      })),
      total: movement.details.reduce((sum, detail) => sum + toNum(detail.totalCost), 0),
      totalBase: movement.details.reduce((sum, detail) => sum + toNum(detail.totalCost) * toNum(movement.rateAtTransaction || 1), 0),
    };

    return voucher;
  }
}
