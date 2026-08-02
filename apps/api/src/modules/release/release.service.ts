import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { RedisService } from '../../../redis/redis.service';
import type { ReleaseManifestDto, SprintInfoDto } from '@ai-consultant/shared-types';

const REDIS_KEY = 'release:manifest';

export interface ReleaseManifest {
  version: string;
  sprint: number;
  name?: string;
  gitSha?: string;
  previousVersion?: string;
  previousSprint?: number;
  deployedAt?: string | null;
  rolledBackAt?: string | null;
}

@Injectable()
export class ReleaseService implements OnModuleInit {
  private readonly logger = new Logger(ReleaseService.name);
  private cached: ReleaseManifest;
  private readonly deployToken: string;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.deployToken = config.get<string>('RELEASE_DEPLOY_TOKEN', '');
    this.cached = this.loadFromFile();
  }

  async onModuleInit() {
    await this.refreshFromRedis();
    if (!this.cached.version) {
      this.cached = {
        version: process.env.APP_VERSION ?? '0.1.0',
        sprint: Number(process.env.SPRINT_NUMBER ?? 32),
        deployedAt: null,
      };
    }
    await this.persist();
  }

  validateDeployToken(token: string | undefined) {
    if (!this.deployToken) {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('RELEASE_DEPLOY_TOKEN not configured');
      }
      return;
    }
    if (!token || token !== this.deployToken) {
      throw new UnauthorizedException('Invalid release deploy token');
    }
  }

  getCurrent(): ReleaseManifestDto {
    return {
      ...this.cached,
      deployTokenConfigured: Boolean(this.deployToken),
    };
  }

  getSuggestedVersion(sprint: number): string {
    return `0.${sprint}.0`;
  }

  async syncManifest(manifest: ReleaseManifest): Promise<ReleaseManifestDto> {
    this.cached = {
      ...this.cached,
      ...manifest,
      sprint: Number(manifest.sprint),
    };
    await this.persist();
    return this.getCurrent();
  }

  async refreshFromRedis(): Promise<void> {
    const client = this.redis.getClient();
    if (!client) return;
    const raw = await client.get(REDIS_KEY);
    if (!raw) return;
    try {
      this.cached = JSON.parse(raw) as ReleaseManifest;
    } catch {
      this.logger.warn('Failed to parse release manifest from Redis');
    }
  }

  private async persist(): Promise<void> {
    const client = this.redis.getClient();
    if (!client) return;
    await client.set(REDIS_KEY, JSON.stringify(this.cached));
  }

  private loadFromFile(): ReleaseManifest {
    const candidates = [
      join(process.cwd(), 'releases', 'manifest.json'),
      join(process.cwd(), '..', '..', 'releases', 'manifest.json'),
    ];
    for (const path of candidates) {
      if (!existsSync(path)) continue;
      try {
        return JSON.parse(readFileSync(path, 'utf8')) as ReleaseManifest;
      } catch {
        this.logger.warn(`Failed to read ${path}`);
      }
    }
    return {
      version: process.env.APP_VERSION ?? '0.1.0',
      sprint: Number(process.env.SPRINT_NUMBER ?? 1),
      deployedAt: null,
    };
  }

  listSprints(): SprintInfoDto[] {
    const candidates = [
      join(process.cwd(), 'docs', 'SPRINTS.md'),
      join(process.cwd(), '..', '..', 'docs', 'SPRINTS.md'),
    ];
    let content = '';
    for (const path of candidates) {
      if (existsSync(path)) {
        content = readFileSync(path, 'utf8');
        break;
      }
    }
    if (!content) return [];

    const rows: SprintInfoDto[] = [];
    const lineRe = /^\|\s*(\d+)\s*\|\s*(\w+)\s*\|\s*(.+?)\s*\|/;
    for (const line of content.split('\n')) {
      const m = line.match(lineRe);
      if (!m) continue;
      rows.push({
        number: Number(m[1]),
        status: m[2],
        description: m[3].trim(),
      });
    }
    return rows;
  }

  assertTokenOrAdmin(token?: string) {
    if (token) {
      this.validateDeployToken(token);
      return;
    }
    throw new BadRequestException('Release token required');
  }
}
