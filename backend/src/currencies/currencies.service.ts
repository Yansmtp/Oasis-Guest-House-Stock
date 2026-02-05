import { Injectable, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { PrismaService } from '../shared/prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface CurrencyEntry {
  code: string;
  name: string;
  rate: number; // USD per 1 unit of currency (base USD)
  effectiveFrom?: Date;
  isDefault?: boolean;
}

@Injectable()
export class CurrenciesService {
  constructor(private prisma: PrismaService) {}

  private filePath = join(__dirname, '..', '..', '..', 'config', 'currencies.json');

  private async readFile(): Promise<CurrencyEntry[]> {
    const raw = await fs.readFile(this.filePath, 'utf8');
    return JSON.parse(raw) as CurrencyEntry[];
  }

  private async writeFile(data: CurrencyEntry[]) {
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  private async getLatestRates(codes: string[]) {
    if (!codes.length) return new Map<string, { rate: number; effectiveFrom: Date }>();

    const rows = await this.prisma.currencyRate.findMany({
      where: { code: { in: codes } },
      orderBy: [{ code: 'asc' }, { effectiveFrom: 'desc' }],
    });

    const map = new Map<string, { rate: number; effectiveFrom: Date }>();
    for (const row of rows) {
      if (!map.has(row.code)) {
        map.set(row.code, {
          rate: row.rate instanceof Prisma.Decimal ? row.rate.toNumber() : (row.rate as any),
          effectiveFrom: row.effectiveFrom,
        });
      }
    }
    return map;
  }

  async getAll(): Promise<CurrencyEntry[]> {
    const list = await this.readFile();
    const codes = list.map(c => c.code);
    const latestRates = await this.getLatestRates(codes);

    return list.map(c => {
      const latest = latestRates.get(c.code);
      return {
        ...c,
        rate: latest?.rate ?? c.rate ?? (c.code === 'USD' ? 1 : 1),
        effectiveFrom: latest?.effectiveFrom,
      };
    });
  }

  async get(code: string): Promise<CurrencyEntry | null> {
    const list = await this.readFile();
    const entry = list.find(c => c.code === code) || null;
    if (!entry) return null;

    const latestRates = await this.getLatestRates([code]);
    const latest = latestRates.get(code);

    return {
      ...entry,
      rate: latest?.rate ?? entry.rate ?? (code === 'USD' ? 1 : 1),
      effectiveFrom: latest?.effectiveFrom,
    };
  }

  async updateRate(code: string, rate: number) {
    const list = await this.readFile();
    const idx = list.findIndex(c => c.code === code);
    if (idx === -1) throw new NotFoundException('Currency not found');

    await this.prisma.currencyRate.create({
      data: {
        code,
        rate,
        effectiveFrom: new Date(),
      },
    });

    return this.get(code);
  }

  async setDefault(code: string) {
    const list = await this.readFile();
    if (!list.some(c => c.code === code)) throw new NotFoundException('Currency not found');
    const newList = list.map(c => ({ ...c, isDefault: c.code === code }));
    await this.writeFile(newList);
    const updated = newList.find(c => c.code === code)!;
    const latest = await this.get(code);
    return { ...updated, rate: latest?.rate ?? updated.rate };
  }

  async getRateAt(code: string, at: Date): Promise<number> {
    if (code === 'USD') return 1;

    const row = await this.prisma.currencyRate.findFirst({
      where: {
        code,
        effectiveFrom: { lte: at },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (row) {
      return row.rate instanceof Prisma.Decimal ? row.rate.toNumber() : (row.rate as any);
    }

    const list = await this.readFile();
    const entry = list.find(c => c.code === code);
    if (entry && typeof entry.rate === 'number') return entry.rate;

    return 1;
  }
}
