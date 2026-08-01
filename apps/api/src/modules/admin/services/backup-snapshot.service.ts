import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdir, stat } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { BackupSnapshotDto } from '@ai-consultant/shared-types';
import { PrismaService } from '../../../prisma/prisma.service';

const execFileAsync = promisify(execFile);

@Injectable()
export class BackupSnapshotService {
  private readonly logger = new Logger(BackupSnapshotService.name);
  private readonly backupDir: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.backupDir = config.get<string>(
      'BACKUP_DIR',
      join(process.cwd(), 'backups'),
    );
  }

  async list(): Promise<BackupSnapshotDto[]> {
    const rows = await this.prisma.backupSnapshot.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => this.toDto(row));
  }

  async get(id: string): Promise<BackupSnapshotDto> {
    const row = await this.prisma.backupSnapshot.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Снапшот не найден');
    return this.toDto(row);
  }

  async create(label?: string): Promise<BackupSnapshotDto> {
    await mkdir(this.backupDir, { recursive: true });
    const snapshotId = randomUUID();
    const fileName = `${snapshotId}.sql.gz`;
    const storagePath = join(this.backupDir, fileName);

    const mode = process.env.BACKUP_MODE ?? 'mock';
    if (mode === 'script') {
      await execFileAsync('bash', [
        join(process.cwd(), 'scripts', 'backup.sh'),
        storagePath,
      ]);
    } else {
      await execFileAsync('node', [
        '-e',
        `require('fs').writeFileSync(process.argv[1], '-- mock backup ${new Date().toISOString()}');`,
        storagePath,
      ]);
    }

    const fileStat = await stat(storagePath).catch(() => null);
    const row = await this.prisma.backupSnapshot.create({
      data: {
        id: snapshotId,
        label: label ?? `backup-${new Date().toISOString()}`,
        storagePath,
        sizeBytes: fileStat?.size ?? 0,
        metadataJson: { mode } as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Backup snapshot created: ${row.id}`);
    return this.toDto(row);
  }

  async restore(id: string) {
    const row = await this.prisma.backupSnapshot.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Снапшот не найден');

    const mode = process.env.BACKUP_MODE ?? 'mock';
    if (mode === 'script') {
      await execFileAsync('bash', [
        join(process.cwd(), 'scripts', 'restore.sh'),
        row.storagePath,
      ]);
    }

    return { restored: true, snapshotId: id };
  }

  private toDto(row: {
    id: string;
    label: string | null;
    storagePath: string;
    sizeBytes: bigint | null;
    metadataJson: unknown;
    createdAt: Date;
  }): BackupSnapshotDto {
    return {
      id: row.id,
      label: row.label,
      storagePath: row.storagePath,
      sizeBytes: row.sizeBytes ? Number(row.sizeBytes) : null,
      metadata: (row.metadataJson as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
