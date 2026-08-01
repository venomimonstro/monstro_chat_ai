import { Module } from '@nestjs/common';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';
import { RbacModule } from '../../common/rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [TeamController],
  providers: [TeamService],
})
export class TeamModule {}
