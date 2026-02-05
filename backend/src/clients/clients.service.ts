import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async create(createClientDto: CreateClientDto) {
    // Verificar si el código ya existe
    const existingClient = await this.prisma.client.findUnique({
      where: { code: createClientDto.code },
    });

    if (existingClient) {
      throw new BadRequestException('El código del cliente ya existe');
    }

    return this.prisma.client.create({
      data: createClientDto,
    });
  }

  async findAll(page: number = 1, limit: number = 10, search: string = '', activeOnly: boolean = true) {
    const skip = (page - 1) * limit;
    
    const where: any = {
      OR: [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    };

    if (activeOnly) {
      where.isActive = true;
    }

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data: clients,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const client = await this.prisma.client.findUnique({
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

    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return client;
  }

  async findByCode(code: string) {
    const client = await this.prisma.client.findUnique({
      where: { code },
    });

    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return client;
  }

  async update(id: number, updateClientDto: UpdateClientDto) {
    await this.findOne(id); // Verificar que existe

    return this.prisma.client.update({
      where: { id },
      data: updateClientDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id); // Verificar que existe

    return this.prisma.client.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getClientMovements(clientId: number, startDate?: Date, endDate?: Date) {
    const where: any = { clientId };

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