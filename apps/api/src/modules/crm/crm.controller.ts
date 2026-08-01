import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/auth.decorators';
import { CrmService } from './crm.service';

@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Public()
  @Get('status')
  getStatus() {
    return this.crmService.getStatus();
  }
}
