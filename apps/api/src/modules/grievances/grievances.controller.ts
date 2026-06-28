import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GrievancesService } from './grievances.service';
import { Public } from '../../common/auth/public.decorator';
import { OptionalAuthGuard } from '../../common/auth/optional-auth.guard';
import { CurrentUser, AuthUser } from '../../common/auth/current-user.decorator';
import { RequireRoles } from '../../common/auth/roles.decorator';
import { Roles } from '../../common/constants';
import {
  ActionDto,
  ConfirmClassificationDto,
  ConfirmClosureDto,
  CreateGrievanceDto,
  DraftAssistDto,
  ForceCloseDto,
  HoldDto,
  ReassignDto,
  RejectDto,
  ReopenDto,
  RerouteDto,
  ResolveDto,
  XroadLookupDto,
} from './grievances.dto';

@Controller('grievances')
export class GrievancesController {
  constructor(private readonly grievances: GrievancesService) {}

  // ── Intake (self-serve OR DA-assisted) ────────────────────────────────────
  @Public()
  @UseGuards(OptionalAuthGuard)
  @Post()
  create(@Body() dto: CreateGrievanceDto, @CurrentUser() actor?: AuthUser) {
    return this.grievances.create(dto, actor);
  }

  // ── Citizen tracking (public, no PII beyond what the citizen already knows) ─
  @Public()
  @Get('public/:idOrYsr')
  publicView(@Param('idOrYsr') idOrYsr: string) {
    return this.grievances.publicView(idOrYsr);
  }

  @Public()
  @Post('public/:idOrYsr/confirm-closure')
  confirmClosure(@Param('idOrYsr') idOrYsr: string, @Body() dto: ConfirmClosureDto) {
    return this.grievances.citizenConfirmClosure(idOrYsr, dto);
  }

  // ── Officer / supervisor queues ───────────────────────────────────────────
  @RequireRoles(Roles.OFFICER, Roles.SUPERVISOR, Roles.COLLECTOR)
  @Get('mine')
  mine(
    @CurrentUser() actor: AuthUser,
    @Query('status') status?: string,
    @Query('slaRisk') slaRisk?: string,
  ) {
    return this.grievances.listForOfficer(actor, { status, slaRisk: slaRisk === 'true' });
  }

  @RequireRoles(Roles.OFFICER, Roles.SUPERVISOR, Roles.COLLECTOR, Roles.AUDITOR)
  @Get()
  list(
    @CurrentUser() actor: AuthUser,
    @Query('status') status?: string,
    @Query('deptId') deptId?: string,
    @Query('mandal') mandal?: string,
    @Query('slaRisk') slaRisk?: string,
  ) {
    return this.grievances.list(actor, { status, deptId, mandal, slaRisk: slaRisk === 'true' });
  }

  @RequireRoles(Roles.OFFICER, Roles.SUPERVISOR, Roles.COLLECTOR, Roles.AUDITOR, Roles.DA)
  @Get(':id')
  full(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.grievances.fullView(id, actor);
  }

  // ── Classification confirmation (DA / officer) ────────────────────────────
  @RequireRoles(Roles.DA, Roles.OFFICER, Roles.SUPERVISOR)
  @Post(':id/classify')
  classify(@Param('id') id: string, @Body() dto: ConfirmClassificationDto, @CurrentUser() actor: AuthUser) {
    return this.grievances.confirmClassification(id, dto, actor);
  }

  // ── Officer workbench actions ─────────────────────────────────────────────
  @RequireRoles(Roles.OFFICER, Roles.SUPERVISOR, Roles.COLLECTOR)
  @Post(':id/accept')
  accept(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.grievances.accept(id, actor);
  }

  @RequireRoles(Roles.OFFICER, Roles.SUPERVISOR, Roles.COLLECTOR)
  @Post(':id/action')
  action(@Param('id') id: string, @Body() dto: ActionDto, @CurrentUser() actor: AuthUser) {
    return this.grievances.recordAction(id, dto, actor);
  }

  @RequireRoles(Roles.OFFICER, Roles.SUPERVISOR, Roles.COLLECTOR)
  @Post(':id/resolve')
  resolve(@Param('id') id: string, @Body() dto: ResolveDto, @CurrentUser() actor: AuthUser) {
    return this.grievances.resolve(id, dto, actor);
  }

  @RequireRoles(Roles.OFFICER, Roles.SUPERVISOR, Roles.COLLECTOR)
  @Post(':id/hold')
  hold(@Param('id') id: string, @Body() dto: HoldDto, @CurrentUser() actor: AuthUser) {
    return this.grievances.hold(id, dto.reason, actor);
  }

  @RequireRoles(Roles.OFFICER, Roles.SUPERVISOR, Roles.COLLECTOR)
  @Post(':id/resume')
  resume(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.grievances.resume(id, actor);
  }

  @RequireRoles(Roles.SUPERVISOR, Roles.COLLECTOR)
  @Post(':id/reassign')
  reassign(@Param('id') id: string, @Body() dto: ReassignDto, @CurrentUser() actor: AuthUser) {
    return this.grievances.reassign(id, dto, actor);
  }

  @RequireRoles(Roles.OFFICER, Roles.SUPERVISOR, Roles.COLLECTOR)
  @Post(':id/reroute')
  reroute(@Param('id') id: string, @Body() dto: RerouteDto, @CurrentUser() actor: AuthUser) {
    return this.grievances.reroute(id, dto.target, dto.reason, actor);
  }

  @RequireRoles(Roles.OFFICER, Roles.SUPERVISOR, Roles.COLLECTOR)
  @Post(':id/merge/:parentId')
  merge(@Param('id') id: string, @Param('parentId') parentId: string, @CurrentUser() actor: AuthUser) {
    return this.grievances.merge(id, parentId, actor);
  }

  @RequireRoles(Roles.SUPERVISOR, Roles.COLLECTOR)
  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectDto, @CurrentUser() actor: AuthUser) {
    return this.grievances.reject(id, dto, actor);
  }

  @RequireRoles(Roles.SUPERVISOR, Roles.COLLECTOR)
  @Post(':id/force-close')
  forceClose(@Param('id') id: string, @Body() dto: ForceCloseDto, @CurrentUser() actor: AuthUser) {
    return this.grievances.forceClose(id, dto, actor);
  }

  // ── X-Road + LLM draft-assist ─────────────────────────────────────────────
  @RequireRoles(Roles.OFFICER, Roles.SUPERVISOR, Roles.COLLECTOR)
  @Post(':id/xroad')
  xroad(@Param('id') id: string, @Body() dto: XroadLookupDto, @CurrentUser() actor: AuthUser) {
    return this.grievances.xroadLookup(id, dto.service, actor);
  }

  @RequireRoles(Roles.OFFICER, Roles.SUPERVISOR, Roles.COLLECTOR)
  @Post(':id/draft-assist')
  draftAssist(@Param('id') id: string, @Body() dto: DraftAssistDto) {
    return this.grievances.draftAssist(id, dto.kind as any);
  }

  // ── Officer-initiated reopen (e.g. quality audit found a bad closure) ──────
  @RequireRoles(Roles.SUPERVISOR, Roles.COLLECTOR, Roles.AUDITOR)
  @Post(':id/reopen')
  reopen(@Param('id') id: string, @Body() dto: ReopenDto, @CurrentUser() actor: AuthUser) {
    return this.grievances.reopen(id, dto, 'OFFICER');
  }
}
