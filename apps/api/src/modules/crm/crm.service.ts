import { Injectable } from '@nestjs/common';

@Injectable()
export class CrmService {
  getStatus() {
    return { module: 'crm', status: 'ready', sprint: 6 };
  }
}
