import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { MovementsService } from '../movements/movements.service';
import { ProductsService } from '../products/products.service';
import { CurrenciesService } from '../currencies/currencies.service';
import { Prisma, MovementType } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs/promises';
import * as path from 'path';

// Helper para convertir Decimal a number
function toNum(value: Prisma.Decimal | number): number {
  return value instanceof Prisma.Decimal ? value.toNumber() : value;
}

type MovementReportExportParams = {
  startDate: Date;
  endDate: Date;
  currency: string;
  type?: MovementType;
  clientId?: number;
  costCenterId?: number;
  invoiceNumber?: string;
};

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private movementsService: MovementsService,
    private productsService: ProductsService,
    private currenciesService: CurrenciesService,
  ) {}

  private movementTypeLabel(type?: MovementType | string | null) {
    if (type === 'ENTRADA') return 'Entradas';
    if (type === 'SALIDA') return 'Salidas';
    return 'Entradas y Salidas';
  }

  private formatDate(date?: Date) {
    if (!date) return '';
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy}`;
  }

  private formatFileDate(date: Date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  }

  private async ensureDir(dirPath: string) {
    await fs.mkdir(dirPath, { recursive: true });
  }

  private async resolveExistingTemplatePath(candidates: string[]) {
    for (const candidate of candidates) {
      if (!candidate) continue;
      try {
        await fs.access(candidate);
        return candidate;
      } catch (e) {
        // noop
      }
    }
    return null;
  }

  private async nextInvoiceNumber(now: Date) {
    const year2 = String(now.getFullYear()).slice(-2);
    const reportDir = path.resolve(process.cwd(), 'uploads', 'reports');
    await this.ensureDir(reportDir);
    const seqPath = path.join(reportDir, 'invoice-seq.json');

    let seqData: any = { year2, seq: 0 };
    try {
      const raw = await fs.readFile(seqPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        seqData = parsed;
      }
    } catch (e) {
      // si no existe, se crea mas abajo
    }

    if (seqData.year2 !== year2) {
      seqData.year2 = year2;
      seqData.seq = 0;
    }
    seqData.seq = Number(seqData.seq || 0) + 1;
    await fs.writeFile(seqPath, JSON.stringify(seqData, null, 2), 'utf8');
    return `FCT${year2}${String(seqData.seq).padStart(4, '0')}`;
  }

  private async getMovementsReportData(params: MovementReportExportParams) {
    const normalizedType = (params.type === MovementType.ENTRADA || params.type === MovementType.SALIDA)
      ? params.type
      : undefined;
    const normalizedClientId = normalizedType === MovementType.SALIDA ? undefined : params.clientId;
    const normalizedCostCenterId = normalizedType === MovementType.ENTRADA ? undefined : params.costCenterId;

    const report = await this.movementsService.getMovementsReport(
      params.startDate,
      params.endDate,
      params.currency || 'USD',
      normalizedType,
      normalizedClientId,
      normalizedCostCenterId,
    );

    return {
      ...report,
      filters: {
        type: normalizedType || null,
        clientId: normalizedClientId || null,
        costCenterId: normalizedCostCenterId || null,
      },
    };
  }

  private async buildMovementsWorkbook(reportData: any, params: MovementReportExportParams) {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Reporte');
    const details = workbook.addWorksheet('Detalle');
    const summary: any = reportData.summary || {};
    const products = Object.values(summary.products || {}) as any[];

    ws.columns = [
      { width: 34 }, { width: 24 }, { width: 24 }, { width: 24 }, { width: 24 },
    ];

    ws.getCell('A1').value = 'REPORTE CASA OASIS - MOVIMIENTOS';
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.mergeCells('A1:E1');

    ws.getCell('A2').value = `Tipo: ${this.movementTypeLabel(params.type)}`;
    ws.getCell('B2').value = `Desde: ${this.formatDate(params.startDate)}`;
    ws.getCell('C2').value = `Hasta: ${this.formatDate(params.endDate)}`;
    ws.getCell('D2').value = `Moneda: ${summary.currency || params.currency || 'USD'}`;
    ws.getCell('E2').value = `Generado: ${this.formatDate(new Date())}`;

    ws.getCell('A4').value = 'Resumen';
    ws.getCell('A4').font = { bold: true };
    ws.getRow(5).values = ['Entradas', 'Salidas', 'Valor Entradas', 'Valor Salidas', 'Tasa USD/CUP'];
    ws.getRow(5).font = { bold: true };
    ws.getRow(6).values = [
      Number(summary.totalEntries || 0),
      Number(summary.totalExits || 0),
      Number(summary.totalEntriesValue || 0),
      Number(summary.totalExitsValue || 0),
      summary.exchangeRateInfo
        ? `1 USD=${Number(summary.exchangeRateInfo.usdToCup || 0).toFixed(4)} CUP | 1 CUP=${Number(summary.exchangeRateInfo.cupToUsd || 0).toFixed(6)} USD`
        : '',
    ];

    ws.getCell('A8').value = 'Movimientos por producto';
    ws.getCell('A8').font = { bold: true };
    ws.getRow(9).values = ['Producto', 'Entradas (Cant.)', 'Entradas (Valor)', 'Salidas (Cant.)', 'Salidas (Valor)'];
    ws.getRow(9).font = { bold: true };
    let rowIndex = 10;
    for (const item of products) {
      ws.getRow(rowIndex).values = [
        item?.product?.name || '',
        Number(item?.entries || 0),
        Number(item?.entriesValue || 0),
        Number(item?.exits || 0),
        Number(item?.exitsValue || 0),
      ];
      rowIndex++;
    }

    details.columns = [
      { header: '#', key: 'idx', width: 6 },
      { header: 'Fecha', key: 'date', width: 16 },
      { header: 'Tipo', key: 'type', width: 12 },
      { header: 'Documento', key: 'document', width: 20 },
      { header: 'Proveedor/Centro', key: 'party', width: 30 },
      { header: 'Productos', key: 'products', width: 54 },
      { header: 'Total', key: 'total', width: 18 },
    ];
    details.getRow(1).font = { bold: true };

    (reportData.movements || []).forEach((m: any, idx: number) => {
      const party = m.type === 'ENTRADA' ? (m.client?.name || '') : (m.costCenter?.name || '');
      const movementTotal = m.reportTotal !== undefined
        ? Number(m.reportTotal)
        : (m.details || []).reduce((sum: number, d: any) => sum + Number(toNum(d.totalCost || 0)), 0);
      const productsText = (m.details || [])
        .map((d: any) => `${d.product?.name || ''} (${Number(toNum(d.quantity || 0)).toFixed(2)} ${d.product?.unit || ''})`)
        .join(', ');

      details.addRow({
        idx: idx + 1,
        date: this.formatDate(m.date),
        type: m.type === 'ENTRADA' ? 'Entrada' : 'Salida',
        document: m.documentNumber || '',
        party,
        products: productsText,
        total: movementTotal,
      });
    });

    const currencyColFormat = '#,##0.00';
    ws.getColumn(3).numFmt = currencyColFormat;
    ws.getColumn(4).numFmt = currencyColFormat;
    details.getColumn(7).numFmt = currencyColFormat;

    return workbook;
  }

  async exportMovementsReportExcel(params: MovementReportExportParams) {
    const reportData = await this.getMovementsReportData(params);
    const reportTemplate = await this.resolveExistingTemplatePath([
      process.env.MOVEMENTS_REPORT_TEMPLATE_PATH || '',
      'd:\\Compartido\\4 CASA OASIS\\1 FREDDY MASTER OASIS\\MODELOS Y REPORTES MASTER\\Reporte COMEDOR MENSUAl 100125.xlsx',
    ]);

    let workbook: ExcelJS.Workbook;
    if (reportTemplate) {
      workbook = new ExcelJS.Workbook();
      try {
        await workbook.xlsx.readFile(reportTemplate);
        const ws = workbook.worksheets[0] || workbook.addWorksheet('Sheet1');
        const summary: any = reportData.summary || {};
        const usdToCup = Number(summary.exchangeRateInfo?.usdToCup || 0);
        const cupToUsd = Number(summary.exchangeRateInfo?.cupToUsd || 0);
        const reportCurrency = String(summary.currency || params.currency || 'USD').toUpperCase();
        const entriesValue = Number(summary.totalEntriesValue || 0);
        const exitsValue = Number(summary.totalExitsValue || 0);

        let usdEntries = entriesValue;
        let usdExits = exitsValue;
        let cupEntries = entriesValue;
        let cupExits = exitsValue;

        if (reportCurrency === 'USD') {
          cupEntries = entriesValue * usdToCup;
          cupExits = exitsValue * usdToCup;
        } else if (reportCurrency === 'CUP') {
          usdEntries = entriesValue * cupToUsd;
          usdExits = exitsValue * cupToUsd;
        }

        ws.getCell('A1').value = 'REPORTE CASA OASIS - MOVIMIENTOS';
        ws.getCell('E3').value = `${this.formatDate(params.startDate)} - ${this.formatDate(params.endDate)}`;
        ws.getCell('B8').value = cupEntries;
        ws.getCell('C8').value = cupExits;
        ws.getCell('D8').value = cupEntries - cupExits;
        ws.getCell('B12').value = usdEntries;
        ws.getCell('C12').value = usdExits;
        ws.getCell('D12').value = usdEntries - usdExits;
        ws.getCell('G3').value = `Tipo: ${this.movementTypeLabel(params.type)}`;
        ws.getCell('G4').value = `Tasa: 1 USD=${usdToCup.toFixed(4)} CUP`;

        ws.getColumn('B').numFmt = '#,##0.00';
        ws.getColumn('C').numFmt = '#,##0.00';
        ws.getColumn('D').numFmt = '#,##0.00';

        const details = workbook.getWorksheet('Detalle') || workbook.addWorksheet('Detalle');
        details.columns = [
          { header: '#', key: 'idx', width: 6 },
          { header: 'Fecha', key: 'date', width: 16 },
          { header: 'Tipo', key: 'type', width: 12 },
          { header: 'Documento', key: 'document', width: 20 },
          { header: 'Proveedor/Centro', key: 'party', width: 30 },
          { header: 'Productos', key: 'products', width: 54 },
          { header: 'Total', key: 'total', width: 18 },
        ];
        details.getRow(1).font = { bold: true };
        (reportData.movements || []).forEach((m: any, idx: number) => {
          const party = m.type === 'ENTRADA' ? (m.client?.name || '') : (m.costCenter?.name || '');
          const movementTotal = m.reportTotal !== undefined
            ? Number(m.reportTotal)
            : (m.details || []).reduce((sum: number, d: any) => sum + Number(toNum(d.totalCost || 0)), 0);
          const productsText = (m.details || [])
            .map((d: any) => `${d.product?.name || ''} (${Number(toNum(d.quantity || 0)).toFixed(2)} ${d.product?.unit || ''})`)
            .join(', ');
          details.addRow({
            idx: idx + 1,
            date: this.formatDate(m.date),
            type: m.type === 'ENTRADA' ? 'Entrada' : 'Salida',
            document: m.documentNumber || '',
            party,
            products: productsText,
            total: movementTotal,
          });
        });
        details.getColumn(7).numFmt = '#,##0.00';
      } catch (e) {
        workbook = await this.buildMovementsWorkbook(reportData, params);
      }
    } else {
      workbook = await this.buildMovementsWorkbook(reportData, params);
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer,
      filename: `reporte_movimientos_${this.formatFileDate(new Date())}.xlsx`,
    };
  }

  async exportMovementsInvoiceExcel(params: MovementReportExportParams) {
    const reportData = await this.getMovementsReportData(params);
    const summary: any = reportData.summary || {};
    const movements = reportData.movements || [];

    const invoiceNumber = (params.invoiceNumber || '').trim() || await this.nextInvoiceNumber(new Date());
    const workbook = new ExcelJS.Workbook();

    const invoiceTemplate = await this.resolveExistingTemplatePath([
      process.env.INVOICE_TEMPLATE_PATH || '',
      'd:\\Compartido\\Plantilla de factura de la casa\\Plantilla).xlsm',
    ]);

    if (invoiceTemplate) {
      try {
        await workbook.xlsx.readFile(invoiceTemplate);
      } catch (e) {
        // Si la plantilla no se puede abrir (por ejemplo, macro no compatible), se usa libro en blanco
      }
    }

    const ws = workbook.worksheets[0] || workbook.addWorksheet('Factura');
    const company = await this.prisma.company.findFirst();
    const currency = summary.currency || params.currency || 'USD';
    const totalEntriesValue = Number(summary.totalEntriesValue || 0);
    const totalExitsValue = Number(summary.totalExitsValue || 0);
    const totalFactura = totalEntriesValue + totalExitsValue;

    // Encabezado estilo plantilla (si no coincide exactamente, se mantienen celdas existentes)
    ws.getCell('A1').value = ws.getCell('A1').value || 'FACTURA';
    ws.getCell('I1').value = invoiceNumber;
    ws.getCell('D5').value = company?.address || ws.getCell('D5').value || '';
    ws.getCell('H5').value = this.formatDate(new Date());
    ws.getCell('H6').value = this.movementTypeLabel(params.type);
    ws.getCell('H7').value = `Reporte (${currency})`;
    ws.getCell('D10').value = `Factura generada desde reporte: ${this.formatDate(params.startDate)} - ${this.formatDate(params.endDate)}`;

    let row = 13;
    for (const movement of movements) {
      const total = movement.reportTotal !== undefined
        ? Number(movement.reportTotal)
        : (movement.details || []).reduce((sum: number, d: any) => sum + Number(toNum(d.totalCost || 0)), 0);
      const party = movement.type === 'ENTRADA'
        ? (movement.client?.name || 'N/A')
        : (movement.costCenter?.name || 'N/A');

      ws.getCell(`B${row}`).value = movement.documentNumber || '';
      ws.getCell(`C${row}`).value = `${movement.type === 'ENTRADA' ? 'Entrada' : 'Salida'} - ${party}`;
      ws.getCell(`E${row}`).value = 1;
      ws.getCell(`F${row}`).value = total;
      ws.getCell(`G${row}`).value = total;
      ws.getCell(`H${row}`).value = 0;
      ws.getCell(`I${row}`).value = total;
      row++;
    }

    ws.getCell(`G${row + 1}`).value = 'Total Factura';
    ws.getCell(`I${row + 1}`).value = totalFactura;

    ws.getColumn('F').numFmt = '#,##0.00';
    ws.getColumn('G').numFmt = '#,##0.00';
    ws.getColumn('I').numFmt = '#,##0.00';

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      buffer,
      filename: `factura_${invoiceNumber}.xlsx`,
      invoiceNumber,
    };
  }

  private async buildUsdCupRateInfo(at: Date) {
    const cupUsd = await this.currenciesService.getRateAt('CUP', at); // USD por 1 CUP
    const usdCup = cupUsd > 0 ? (1 / cupUsd) : 0; // CUP por 1 USD
    return {
      at,
      usdToCup: usdCup,
      cupToUsd: cupUsd,
    };
  }

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
    const exchangeRateInfo = await this.buildUsdCupRateInfo(now);

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
        exchangeRateInfo,
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
      exchangeRateInfo: await this.buildUsdCupRateInfo(endDate || new Date()),
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
      exchangeRateInfo: await this.buildUsdCupRateInfo(endDate || new Date()),
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
