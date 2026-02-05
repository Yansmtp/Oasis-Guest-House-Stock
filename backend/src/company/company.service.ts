import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import * as fs from 'fs';
import * as path from 'path';
import { promises as fsp } from 'fs';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  private async findLatestLogoPath(): Promise<string | null> {
    const logosDir = path.join(process.cwd(), 'uploads', 'logos');
    try {
      const entries = await fsp.readdir(logosDir, { withFileTypes: true });
      const files = entries.filter(e => e.isFile()).map(e => e.name);
      if (!files.length) return null;

      let latest = files[0];
      let latestMtime = (await fsp.stat(path.join(logosDir, latest))).mtimeMs;
      for (const name of files.slice(1)) {
        const mtime = (await fsp.stat(path.join(logosDir, name))).mtimeMs;
        if (mtime > latestMtime) {
          latestMtime = mtime;
          latest = name;
        }
      }
      return `/uploads/logos/${latest}`;
    } catch (e) {
      return null;
    }
  }

  async findOne() {
    const company = await this.prisma.company.findFirst();

    if (!company) {
      // Crear una empresa por defecto si no existe
      const logo = await this.findLatestLogoPath();
      return this.prisma.company.create({
        data: {
          name: 'Casa de Renta',
          lowStockThreshold: 10,
          logo: logo || undefined,
        },
      });
    }

    if (!company.logo) {
      const logo = await this.findLatestLogoPath();
      if (logo) {
        return this.prisma.company.update({
          where: { id: company.id },
          data: { logo },
        });
      }
    }

    return company;
  }

  async update(id: number, updateCompanyDto: UpdateCompanyDto) {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    return this.prisma.company.update({
      where: { id },
      data: updateCompanyDto,
    });
  }

  async updateLogo(id: number, file: Express.Multer.File) {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // Eliminar logo anterior si existe
    if (company.logo) {
      let logoPath = company.logo;
      // Si viene como URL absoluta, extraer el path
      try {
        if (/^https?:\/\//i.test(logoPath)) {
          const parsed = new URL(logoPath);
          logoPath = parsed.pathname;
        }
      } catch (e) {
        // noop
      }
      // Normalizar para evitar rutas absolutas
      logoPath = logoPath.replace(/^[\\/]+/, '');
      const oldLogoPath = path.join(process.cwd(), logoPath);
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }

    // Guardar nueva ruta del logo
    const logoPath = `/uploads/logos/${file.filename}`;

    return this.prisma.company.update({
      where: { id },
      data: { logo: logoPath },
    });
  }

  async getLogoPath(id: number) {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company || !company.logo) {
      return null;
    }

    return company.logo;
  }
}
