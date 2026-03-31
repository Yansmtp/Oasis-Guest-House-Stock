import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { execFile } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { isAbsolute, join } from 'path';

@Injectable()
export class MaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceService.name);
  private autoBackupTimer: NodeJS.Timeout | null = null;
  private autoBackupEnabled = true;
  private autoBackupIntervalHours = 24;

  private getRepoRoot() {
    // dist/src/maintenance -> dist/src -> dist -> backend -> repo root
    return join(__dirname, '..', '..', '..', '..');
  }

  private runPowerShell(scriptPath: string, args: string[] = []): Promise<string> {
    if (process.platform !== 'win32') {
      throw new InternalServerErrorException('Backup/restore no disponible en este entorno (PowerShell requerido)');
    }
    return new Promise((resolve, reject) => {
      execFile(
        'powershell',
        ['-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...args],
        { windowsHide: true },
        (error, stdout, stderr) => {
          if (error) {
            return reject(new InternalServerErrorException(stderr || error.message));
          }
          resolve(stdout || '');
        },
      );
    });
  }

  private extractPathFromOutput(output: string, marker: string) {
    const lines = String(output || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const found = lines.find((l) => l.toLowerCase().includes(marker.toLowerCase()));
    if (!found) return null;
    const parts = found.split(':');
    return parts.length > 1 ? parts.slice(1).join(':').trim() : null;
  }

  getConfig() {
    return {
      defaultBackupDir: this.resolveBackupDir(),
      autoBackupEnabled: this.autoBackupEnabled,
      autoBackupIntervalHours: this.autoBackupIntervalHours,
    };
  }

  async backup(outputDir?: string, auto = false) {
    const root = this.getRepoRoot();
    const script = join(root, 'scripts', 'db-backup.ps1');
    const dir = this.resolveBackupDir(outputDir);
    this.ensureBackupDir(dir);
    const output = await this.runPowerShell(script, ['-OutputDir', dir]);
    const path = this.extractPathFromOutput(output, 'Backup completado en');
    return { ok: true, output, path, auto };
  }

  async restore(backupDir: string) {
    if (!backupDir || !backupDir.trim()) {
      throw new InternalServerErrorException('Debe indicar la carpeta del respaldo a restaurar');
    }
    const root = this.getRepoRoot();
    const script = join(root, 'scripts', 'db-restore.ps1');
    const output = await this.runPowerShell(script, ['-BackupDir', backupDir.trim()]);
    const path = this.extractPathFromOutput(output, 'Restaur');
    return { ok: true, output, path };
  }

  async reset() {
    const root = this.getRepoRoot();
    const script = join(root, 'scripts', 'db-reset.ps1');
    const output = await this.runPowerShell(script, ['-Force']);
    return { ok: true, output };
  }
}
