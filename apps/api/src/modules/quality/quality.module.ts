import { Module } from '@nestjs/common';
import { QualityController } from './quality.controller';
import { MessageFeedbackService } from './services/message-feedback.service';
import { BadAnswersService } from './services/bad-answers.service';

@Module({
  controllers: [QualityController],
  providers: [MessageFeedbackService, BadAnswersService],
  exports: [MessageFeedbackService, BadAnswersService],
})
export class QualityModule {}
