import { Module } from '@nestjs/common';
import { PromptExperimentService } from './prompt-experiment.service';

@Module({
  providers: [PromptExperimentService],
  exports: [PromptExperimentService],
})
export class PromptExperimentModule {}
