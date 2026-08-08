import { Module } from '@nestjs/common';
import { PromptsController } from './prompts.controller';
import { PromptsService } from './prompts.service';
import { PlaygroundService } from './playground.service';
import { PromptGenerationService } from './prompt-generation.service';
import { PromptExperimentModule } from './prompt-experiment.module';
import { PromptExperimentService } from './prompt-experiment.service';
import { AiModule } from '../ai/ai.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [AiModule, KnowledgeModule, PromptExperimentModule],
  controllers: [PromptsController],
  providers: [
    PromptsService,
    PlaygroundService,
    PromptGenerationService,
    PromptExperimentService,
  ],
  exports: [PromptsService, PromptExperimentService],
})
export class PromptsModule {}
