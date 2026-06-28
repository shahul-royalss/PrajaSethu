import { Controller, Post } from '@nestjs/common';
import { SlaService } from './sla.service';
import { RequireRoles } from '../../common/auth/roles.decorator';
import { Roles } from '../../common/constants';

@Controller('sla')
export class SlaController {
  constructor(private readonly sla: SlaService) {}

  // Run the predict/escalate sweep on demand (the background sweep also runs).
  @RequireRoles(Roles.SUPERVISOR, Roles.COLLECTOR, Roles.AUDITOR)
  @Post('sweep')
  sweep() {
    return this.sla.sweep();
  }
}
