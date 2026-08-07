import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PromptScope, UserRole } from '@prisma/client';

const DEFAULT_PROMPT_CHAR_LIMIT = 4000;

@Injectable()
export class PromptsService {
  constructor(private readonly prisma: PrismaService) {}

  async listHistory(tenantId: string, scope: PromptScope) {
    const prompts = await this.prisma.prompt.findMany({
      where: {
        scope,
        ...(scope === 'tenant' ? { tenantId } : { tenantId: null }),
      },
      orderBy: { version: 'desc' },
      take: 1000,
    });
    return prompts.map((p) => this.toDto(p));
  }

  async getActive(tenantId: string, scope: PromptScope) {
    const prompt = await this.prisma.prompt.findFirst({
      where: {
        scope,
        isActive: true,
        ...(scope === 'tenant' ? { tenantId } : { tenantId: null }),
      },
    });
    return prompt ? this.toDto(prompt) : null;
  }

  async createVersion(params: {
    tenantId: string | null;
    scope: PromptScope;
    content: string;
    createdBy: string;
    userRole: UserRole;
  }) {
    this.assertScopeAccess(params.scope, params.userRole);

    const charLimit = params.tenantId
      ? await this.getPromptCharLimit(params.tenantId)
      : 8000;

    if (params.content.length > charLimit) {
      throw new BadRequestException(
        `Превышен лимит символов промпта (${charLimit})`,
      );
    }

    const last = await this.prisma.prompt.findFirst({
      where: {
        scope: params.scope,
        ...(params.scope === 'tenant'
          ? { tenantId: params.tenantId }
          : { tenantId: null }),
      },
      orderBy: { version: 'desc' },
    });

    const version = (last?.version ?? 0) + 1;

    await this.prisma.prompt.updateMany({
      where: {
        scope: params.scope,
        isActive: true,
        ...(params.scope === 'tenant'
          ? { tenantId: params.tenantId }
          : { tenantId: null }),
      },
      data: { isActive: false },
    });

    const prompt = await this.prisma.prompt.create({
      data: {
        tenantId: params.scope === 'tenant' ? params.tenantId : null,
        scope: params.scope,
        content: params.content,
        version,
        isActive: true,
        createdBy: params.createdBy,
      },
    });

    return this.toDto(prompt);
  }

  async activateVersion(
    id: string,
    tenantId: string,
    userRole: UserRole,
  ) {
    const prompt = await this.prisma.prompt.findUnique({ where: { id } });
    if (!prompt) throw new NotFoundException('Промпт не найден');

    if (prompt.scope === 'tenant' && prompt.tenantId !== tenantId) {
      throw new NotFoundException('Промпт не найден');
    }

    this.assertScopeAccess(prompt.scope, userRole);

    await this.prisma.prompt.updateMany({
      where: {
        scope: prompt.scope,
        ...(prompt.scope === 'tenant'
          ? { tenantId: prompt.tenantId }
          : { tenantId: null }),
      },
      data: { isActive: false },
    });

    const updated = await this.prisma.prompt.update({
      where: { id },
      data: { isActive: true },
    });

    return this.toDto(updated);
  }

  async getPromptCharLimit(tenantId: string): Promise<number> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        tariff: true,
        subscriptions: {
          where: { status: { in: ['trialing', 'active'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { tariff: true },
        },
      },
    });

    const tariff =
      tenant?.subscriptions[0]?.tariff ?? tenant?.tariff ?? null;
    const features = tariff?.featuresJson as Record<string, unknown> | null;
    const limit = features?.promptCharLimit;
    return typeof limit === 'number' && limit > 0
      ? limit
      : DEFAULT_PROMPT_CHAR_LIMIT;
  }

  private assertScopeAccess(scope: PromptScope, role: UserRole) {
    if (scope === 'global' && !['owner', 'admin'].includes(role)) {
      throw new ForbiddenException(
        'Глобальный промпт доступен только owner/admin',
      );
    }
  }

  private toDto(prompt: {
    id: string;
    tenantId: string | null;
    scope: PromptScope;
    content: string;
    version: number;
    isActive: boolean;
    createdBy: string | null;
    createdAt: Date;
  }) {
    return {
      id: prompt.id,
      tenantId: prompt.tenantId,
      scope: prompt.scope,
      content: prompt.content,
      version: prompt.version,
      isActive: prompt.isActive,
      createdBy: prompt.createdBy,
      createdAt: prompt.createdAt.toISOString(),
    };
  }
}
