import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/auth.decorators';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Public()
  @Get('status')
  getStatus() {
    return this.aiService.getStatus();
  }
}
