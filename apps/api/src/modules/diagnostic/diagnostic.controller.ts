import { Controller, Get, Post, Body, Version } from '@nestjs/common';
import { Public } from '../../common/decorators/auth.decorators';
import { DiagnosticService } from './diagnostic.service';

@Controller('diagnostic')
export class DiagnosticController {
  constructor(private readonly diagnostic: DiagnosticService) {}

  @Public()
  @Get()
  getReport() {
    return this.diagnostic.getReport();
  }

  @Public()
  @Post('run')
  runNow(@Body('full') full?: boolean) {
    return this.diagnostic.runNow(Boolean(full));
  }

  @Public()
  @Get('quick')
  quickCheck() {
    return this.diagnostic.quickCheck();
  }
}
