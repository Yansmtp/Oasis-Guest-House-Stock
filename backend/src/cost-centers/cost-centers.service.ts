import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';

@Injectable()
export class CostCentersService {
  constructor(private prisma: PrismaService) {}

  async create(createCostCenterDto: CreateCostCenterDto) {
    // Verificar si el código ya existe
    const existingCostCenter = await this.prisma.costCenter.findUnique({
      where: { code: createCostCenterDto.code },
    });

    if (existingCostCenter) {
      throw new BadRequestException('El código del centro de costo ya existe');
    }

    return this.prisma.costCenter.create({
      data: createCostCenterDto,
    });
  }

  async findAll(page: number = 1, limit: number = 10, search: string = '', activeOnly: boolean = true) {
    const skip = (page - 1) * limit;
    
    const where: any = {
      OR: [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    };

    if (activeOnly) {
      where.isActive = true;
    }

    const [costCenters, total] = await Promise.all([
      this.prisma.costCenter.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.costCenter.count({ where }),
    ]);

    return {
      data: costCenters,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const costCenter = await this.prisma.costCenter.findUnique({
      where: { id },
      include: {
        movements: {
          take: 10,
          orderBy: { date: 'desc' },
          include: {
            details: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!costCenter) {
      throw new NotFoundException('Centro de costo no encontrado');
    }

    return costCenter;
  }

  async findByCode(code: string) {
    const costCenter = await this.prisma.costCenter.findUnique({
      where: { code },
    });

    if (!costCenter) {
      throw new NotFoundException('Centro de costo no encontrado');
    }

    return costCenter;
  }

  async update(id: number, updateCostCenterDto: UpdateCostCenterDto) {
    await this.findOne(id); // Verificar que existe

    return this.prisma.costCenter.update({
      where: { id },
      data: updateCostCenterDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id); // Verificar que existe

    return this.prisma.costCenter.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getCostCenterMovements(costCenterId: number, startDate?: Date, endDate?: Date) {
    const where: any = { costCenterId };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    return this.prisma.movement.findMany({
      where,
      include: {
        details: {
          include: {
            product: true,
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }
}