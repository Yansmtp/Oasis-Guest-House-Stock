import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { execFile } from 'child_process';
import { join } from 'path';

@Injectable()
export class MaintenanceService {
  private getRepoRoot() {
    // dist/src/maintenance -> dist/src -> dist -> backend -> repo root
    return join(__dirname, '..', '..', '..', '..');
  }

  private runPowerShell(scriptPath: string, args: string[] = []): Promise<string> {
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

  async backup() {
    const root = this.getRepoRoot();
    const script = join(root, 'scripts', 'db-backup.ps1');
    const output = await this.runPowerShell(script);
    return { ok: true, output };
  }

  async reset() {
    const root = this.getRepoRoot();
    const script = join(root, 'scripts', 'db-reset.ps1');
    const output = await this.runPowerShell(script, ['-Force']);
    return { ok: true, output };
  }
}
