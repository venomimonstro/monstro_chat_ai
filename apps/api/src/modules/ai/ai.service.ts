import { Injectable } from '@nestjs/common';
import { ProviderRegistryService } from './providers/provider-registry.service';
import { ProviderCredentialsService } from './services/provider-credentials.service';

@Injectable()
export class AiService {
  constructor(
    private readonly providers: ProviderRegistryService,
    private readonly credentials: ProviderCredentialsService,
  ) {}

  getStatus() {
    const chain = this.providers.getChain();
    const real = chain.filter((p) => p.name !== 'mock' && p.isAvailable());
    return {
      module: 'ai',
      status: real.length > 0 ? 'ready' : 'degraded',
      sprint: 4,
      llmConnected: real.length > 0,
      credentials: this.credentials.getDiagnostics(),
      providers: chain.map((p) => ({
        name: p.name,
        available: p.isAvailable(),
        model: p.defaultModel,
      })),
    };
  }
}
