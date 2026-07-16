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
  CopilotAskDto,
  CreateGrievanceDto,
  DeskReviewDecisionDto,
  DraftAssistDto,
  ForceCloseDto,
  HoldDto,
  ReassignDto,
  RejectDto,
  ReopenDto,
  ReopenRequestDto,
  RerouteDto,
  ResolveDto,
  VerificationDecisionDto,
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

  // ── Reopen REQUEST (Saarthi 2.0) — mandatory reason (typed or voice) → the
  //    case enters a senior officer's quick desk review before any reopen.
  @Public()
  @Post('public/:idOrYsr/reopen-request')
  reopenRequest(@Param('idOrYsr') idOrYsr: string, @Body() dto: ReopenRequestDto) {
    return this.grievances.reopenRequest(idOrYsr, dto);
  }

  // ── Saarthi Copilot — citizen assistant on the track page (grounded Q&A) ──
  @Public()
  @Post('public/copilot')
  copilot(@Body() dto: CopilotAskDto) {
    return this.grievances.copilotAsk(dto);
  }

  // ── Citizen's own grievances (any valid citizen token) ────────────────────
  @Get('citizen/mine')
  citizenMine(@CurrentUser() actor: AuthUser) {
    return this.grievances.listForCitizen(actor);
  }

  // ── Human verification desk — the 95% gate's human half (§8.4) ────────────
  @RequireRoles(Roles.DA, Roles.OFFICER, Roles.SUPERVISOR, Roles.COLLECTOR)
  @Get('verification/queue')
  verificationQueue(@CurrentUser() actor: AuthUser) {
    return this.grievances.verificationQueue(actor);
  }

  @RequireRoles(Roles.DA, Roles.OFFICER, Roles.SUPERVISOR, Roles.COLLECTOR)
  @Post(':id/verification/decision')
  verificationDecision(@Param('id') id: string, @Body() dto: VerificationDecisionDto, @CurrentUser() actor: AuthUser) {
    return this.grievances.verificationDecision(id, dto, actor);
  }

  // ── Quick desk review of citizen reopen requests ───────────────────────────
  @RequireRoles(Roles.OFFICER, Roles.SUPERVISOR, Roles.COLLECTOR, Roles.AUDITOR)
  @Get('desk-review/queue')
  deskReviewQueue(@CurrentUser() actor: AuthUser) {
    return this.grievances.deskReviewQueue(actor);
  }

  @RequireRoles(Roles.OFFICER, Roles.SUPERVISOR, Roles.COLLECTOR)
  @Post(':id/desk-review/decision')
  deskReviewDecision(@Param('id') id: string, @Body() dto: DeskReviewDecisionDto, @CurrentUser() actor: AuthUser) {
    return this.grievances.deskReviewDecision(id, dto, actor);
  }

  // ── Unmerge escape hatch (§9.2) — re-enters the AI pipeline, trains dedupe ─
  @RequireRoles(Roles.OFFICER, Roles.SUPERVISOR, Roles.COLLECTOR)
  @Post(':id/unmerge')
  unmerge(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.grievances.unmerge(id, actor);
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

  // AI complaint analysis (root cause + suggestions) — advisory only.
  @RequireRoles(Roles.OFFICER, Roles.SUPERVISOR, Roles.COLLECTOR, Roles.AUDITOR, Roles.DA)
  @Post(':id/ai-analysis')
  aiAnalysis(@Param('id') id: string) {
    return this.grievances.aiAnalysis(id);
  }

  // ── Officer-initiated reopen (e.g. quality audit found a bad closure) ──────
  @RequireRoles(Roles.SUPERVISOR, Roles.COLLECTOR, Roles.AUDITOR)
  @Post(':id/reopen')
  reopen(@Param('id') id: string, @Body() dto: ReopenDto, @CurrentUser() actor: AuthUser) {
    return this.grievances.reopen(id, dto, 'OFFICER');
  }
}
