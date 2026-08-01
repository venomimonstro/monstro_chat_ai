import { Injectable } from '@nestjs/common';
import { ProviderRegistryService } from './providers/provider-registry.service';

@Injectable()
export class AiService {
  constructor(private readonly providers: ProviderRegistryService) {}

  getStatus() {
    const chain = this.providers.getChain();
    return {
      module: 'ai',
      status: 'ready',
      sprint: 4,
      providers: chain.map((p) => ({
        name: p.name,
        available: p.isAvailable(),
        model: p.defaultModel,
      })),
    };
  }
}
