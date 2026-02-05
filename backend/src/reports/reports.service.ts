import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { MovementsService } from '../movements/movements.service';
import { ProductsService } from '../products/products.service';
import { CurrenciesService } from '../currencies/currencies.service';
import { Prisma } from '@prisma/client';

// Helper para convertir Decimal a number
function toNum(value: Prisma.Decimal | number): number {
  return value instanceof Prisma.Decimal ? value.toNumber() : value;
}

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private movementsService: MovementsService,
    private productsService: ProductsService,
    private currenciesService: CurrenciesService,
  ) {}

  private async convertUsdToTarget(amountUsd: number, targetCurrency: string, at: Date, cache: Map<string, number>) {
    if (targetCurrency === 'USD') return amountUsd;
    const key = `${targetCurrency}|${at.toISOString()}`;
    if (!cache.has(key)) {
      const rate = await this.currenciesService.getRateAt(targetCurrency, at);
      cache.set(key, rate);
    }
    const rate = cache.get(key)!;
    return rate ? amountUsd / rate : amountUsd;
  }

  private async movementAmountInTarget(detailTotal: number, movement: any, targetCurrency: string, cache: Map<string, number>) {
    const amount = toNum(detailTotal);
    if (targetCurrency === movement.currencyCode) return amount;

    const rateAtTransaction = movement.rateAtTransaction !== undefined
      ? toNum(movement.rateAtTransaction)
      : 1;

    const amountUsd = movement.currencyCode === 'USD' ? amount : amount * rateAtTransaction;
    return this.convertUsdToTarget(amountUsd, targetCurrency, movement.date, cache);
  }

  async getStockReport(targetCurrency: string = 'USD') {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: { stock: 'asc' },
    });

    const lowStockCount = products.filter(
      p => toNum(p.stock) <= toNum(p.minStock)
    ).length;

    const totalValueUsd = products.reduce(
      (sum, product) => sum + toNum(product.stock) * toNum(product.unitCost),
      0
    );
    const rateCache = new Map<string, number>();
    const now = new Date();
    const totalValue = await this.convertUsdToTarget(totalValueUsd, targetCurrency, now, rateCache);

    const convertedProducts = await Promise.all(products.map(async product => {
      const unitCostUsd = toNum(product.unitCost);
      const unitCostReport = await this.convertUsdToTarget(unitCostUsd, targetCurrency, now, rateCache);
      const totalValueReport = await this.convertUsdToTarget(toNum(product.stock) * unitCostUsd, targetCurrency, now, rateCache);
      return {
        ...product,
        unitCostReport,
        totalValueReport,
      };
    }));

    return {
      products: convertedProducts,
      summary: {
        totalProducts: products.length,
        lowStockCount,
        totalValue,
        currency: targetCurrency,
      },
    };
  }

  async getClientReport(clientId: number, startDate?: Date, endDate?: Date, targetCurrency: string = 'USD') {
    const movements = await this.prisma.movement.findMany({
      where: {
        clientId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        details: {
          include: { product: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    const summary = {
      totalMovements: movements.length,
      totalEntries: 0,
      totalExits: 0,
      totalValue: 0,
      products: {},
      currency: targetCurrency,
    };

    const rateCache = new Map<string, number>();
    const movementTotals = new Map<number, number>();
    for (const movement of movements) {
      for (const detail of movement.details) {
        const productId = detail.productId;
        const value = await this.movementAmountInTarget(
          toNum(detail.totalCost),
          movement,
          targetCurrency,
          rateCache
        );

        if (movement.type === 'ENTRADA') {
          summary.totalEntries++;
        } else {
          summary.totalExits++;
        }

        summary.totalValue += value;

        if (!summary.products[productId]) {
          summary.products[productId] = {
            product: detail.product,
            totalQuantity: 0,
            totalValue: 0,
          };
        }

        summary.products[productId].totalQuantity += detail.quantity;
        summary.products[productId].totalValue += value;
        movementTotals.set(movement.id, (movementTotals.get(movement.id) || 0) + value);
      }
    }

    const movementsWithTotals = movements.map(m => ({
      ...m,
      reportTotal: movementTotals.get(m.id) || 0,
      reportCurrency: targetCurrency,
    }));

    return { movements: movementsWithTotals, summary };
  }

  async getCostCenterReport(costCenterId: number, startDate?: Date, endDate?: Date, targetCurrency: string = 'USD') {
    const movements = await this.prisma.movement.findMany({
      where: {
        costCenterId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        details: {
          include: { product: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    const summary = {
      totalMovements: movements.length,
      totalEntries: 0,
      totalExits: 0,
      totalValue: 0,
      products: {},
      currency: targetCurrency,
    };

    const rateCache = new Map<string, number>();
    const movementTotals = new Map<number, number>();
    for (const movement of movements) {
      for (const detail of movement.details) {
        const productId = detail.productId;
        const value = await this.movementAmountInTarget(
          toNum(detail.totalCost),
          movement,
          targetCurrency,
          rateCache
        );

        if (movement.type === 'ENTRADA') {
          summary.totalEntries++;
        } else {
          summary.totalExits++;
        }

        summary.totalValue += value;

        if (!summary.products[productId]) {
          summary.products[productId] = {
            product: detail.product,
            totalQuantity: 0,
            totalValue: 0,
          };
        }

        summary.products[productId].totalQuantity += detail.quantity;
        summary.products[productId].totalValue += value;
        movementTotals.set(movement.id, (movementTotals.get(movement.id) || 0) + value);
      }
    }

    const movementsWithTotals = movements.map(m => ({
      ...m,
      reportTotal: movementTotals.get(m.id) || 0,
      reportCurrency: targetCurrency,
    }));

    return { movements: movementsWithTotals, summary };
  }

  async getProductMovementHistory(productId: number, startDate?: Date, endDate?: Date) {
    const details = await this.prisma.movementDetail.findMany({
      where: {
        productId,
        movement: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      include: {
        movement: {
          include: {
            client: true,
            costCenter: true,
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { movement: { date: 'desc' } },
    });

    const product = await this.prisma.product.findUnique({ where: { id: productId } });

    return { product, movements: details };
  }
}
