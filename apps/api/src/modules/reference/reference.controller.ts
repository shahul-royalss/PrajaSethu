import { Controller, Get, Query } from '@nestjs/common';
import { ReferenceService } from './reference.service';
import { Public } from '../../common/auth/public.decorator';
import { RequireRoles } from '../../common/auth/roles.decorator';
import { Roles } from '../../common/constants';

@Controller('reference')
export class ReferenceController {
  constructor(private readonly reference: ReferenceService) {}

  // Public: the operator console needs the taxonomy to confirm AI suggestions.
  @Public()
  @Get('departments')
  departments() {
    return this.reference.departments();
  }

  @Public()
  @Get('subjects')
  subjects(@Query('deptId') deptId?: string) {
    return this.reference.subjects(deptId);
  }

  @Public()
  @Get('xroad-services')
  xroadServices() {
    return this.reference.xroadServices();
  }

  @RequireRoles(Roles.SUPERVISOR, Roles.COLLECTOR, Roles.DA, Roles.OFFICER)
  @Get('officers')
  officers(@Query('deptId') deptId?: string) {
    return this.reference.officers(deptId);
  }
}
