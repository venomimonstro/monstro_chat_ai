import { Injectable, Logger } from '@nestjs/common';
import { DeploymentRecordStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ReleaseManifest } from '../../release/release.service';

export interface DeploymentRecordDto {
  id: string;
  version: string;
  sprint: number;
  gitSha: string | null;
  status: DeploymentRecordStatus;
  appliedAt: string;
  rolledBackAt: string | null;
}

@Injectable()
export class DeploymentRecordsService {
  private readonly logger = new Logger(DeploymentRecordsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(limit = 30): Promise<DeploymentRecordDto[]> {
    const rows = await this.prisma.deploymentRecord.findMany({
      orderBy: { appliedAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => this.toDto(row));
  }

  async recordDeployment(manifest: ReleaseManifest): Promise<DeploymentRecordDto> {
    await this.prisma.deploymentRecord.updateMany({
      where: { status: 'active' },
      data: { status: 'superseded' },
    });

    const row = await this.prisma.deploymentRecord.create({
      data: {
        version: manifest.version,
        sprint: manifest.sprint,
        gitSha: manifest.gitSha ?? null,
        status: 'active',
        manifestJson: manifest as unknown as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Deployment recorded: v${manifest.version} sprint ${manifest.sprint}`);
    return this.toDto(row);
  }

  async markRolledBack(version: string): Promise<void> {
    await this.prisma.deploymentRecord.updateMany({
      where: { version, status: 'active' },
      data: {
        status: 'rolled_back',
        rolledBackAt: new Date(),
      },
    });
  }

  async getActive(): Promise<DeploymentRecordDto | null> {
    const row = await this.prisma.deploymentRecord.findFirst({
      where: { status: 'active' },
      orderBy: { appliedAt: 'desc' },
    });
    return row ? this.toDto(row) : null;
  }

  async findByVersion(version: string): Promise<DeploymentRecordDto | null> {
    const row = await this.prisma.deploymentRecord.findFirst({
      where: { version },
      orderBy: { appliedAt: 'desc' },
    });
    return row ? this.toDto(row) : null;
  }

  private toDto(row: {
    id: string;
    version: string;
    sprint: number;
    gitSha: string | null;
    status: DeploymentRecordStatus;
    appliedAt: Date;
    rolledBackAt: Date | null;
  }): DeploymentRecordDto {
    return {
      id: row.id,
      version: row.version,
      sprint: row.sprint,
      gitSha: row.gitSha,
      status: row.status,
      appliedAt: row.appliedAt.toISOString(),
      rolledBackAt: row.rolledBackAt?.toISOString() ?? null,
    };
  }
}
