import { Module } from '@nestjs/common';
import { PromptsController } from './prompts.controller';
import { PromptsService } from './prompts.service';
import { PlaygroundService } from './playground.service';
import { PromptExperimentModule } from './prompt-experiment.module';
import { PromptExperimentService } from './prompt-experiment.service';
import { PromptRegressionService } from './prompt-regression.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule, PromptExperimentModule],
  controllers: [PromptsController],
  providers: [
    PromptsService,
    PlaygroundService,
    PromptExperimentService,
    PromptRegressionService,
  ],
  exports: [PromptsService, PromptExperimentService, PlaygroundService],
})
export class PromptsModule {}
