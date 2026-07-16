import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Category, Channels } from '../../common/constants';

const CHANNEL_VALUES = Object.values(Channels);
const CATEGORY_VALUES = Object.values(Category);

export class CreateGrievanceDto {
  @IsIn(CHANNEL_VALUES)
  channel!: string;

  @IsOptional()
  @IsString()
  language?: string;

  // Either a typed description or a voice blob ref (transcribed via Bhashini ASR).
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  voiceInputRef?: string;

  // Petitioner — Aadhaar is optional (mobile-only citizens are supported).
  // Mobile is optional for AUTHENTICATED citizens (identity comes from the JWT);
  // anonymous/assisted intake still requires it (enforced in the service).
  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  aadhaar?: string;

  // ── Petitioner details (PGRS form) ──
  @IsOptional()
  @IsString()
  coName?: string; // C/o (father/husband) name

  @IsOptional()
  @IsString()
  dob?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  houseNo?: string;

  @IsOptional()
  @IsString()
  habitation?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  village?: string;

  @IsOptional()
  @IsString()
  mandal?: string;

  @IsOptional()
  @IsString()
  secretariatCode?: string;

  @IsOptional()
  @IsString()
  applicantType?: string; // INDIVIDUAL | COMMUNITY

  // ── Location of the grievance (may differ from the applicant's address) ──
  @IsOptional()
  @IsString()
  grievanceDistrict?: string;

  @IsOptional()
  @IsString()
  grievanceMandal?: string;

  @IsOptional()
  @IsString()
  grievanceVillage?: string;

  @IsOptional()
  @IsArray()
  vulnerabilityFlags?: string[];

  // Operator-confirmed category (after reviewing the AI suggestion). If deptId is
  // present the grievance is classified + assigned immediately; else it stays
  // REGISTERED awaiting human confirmation.
  @IsOptional()
  @IsString()
  deptId?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  subSubjectId?: string;

  @IsOptional()
  @IsIn(CATEGORY_VALUES)
  category?: string;

  // Assisted path: citizen consent to file + cross-dept verification (logged).
  @IsOptional()
  @IsBoolean()
  consent?: boolean;

  @IsOptional()
  @IsArray()
  consentScope?: string[];

  // ── Live location captured at submit (with consent) — sent to the officer ──
  @IsOptional()
  @IsLatitude()
  geoLat?: number;

  @IsOptional()
  @IsLongitude()
  geoLng?: number;

  @IsOptional()
  @IsNumber()
  geoAccuracy?: number;

  // ── Saarthi 2.0 — auto-detected language (client-side live detection) ──
  @IsOptional()
  @IsString()
  detectedLang?: string;

  @IsOptional()
  @IsNumber()
  langConfidence?: number;

  @IsOptional()
  @IsBoolean()
  codeSwitched?: boolean;

  // ── Saarthi 2.0 — original voice recording (evidence; travels untouched) ──
  @IsOptional()
  @IsString()
  voiceBase64?: string;

  @IsOptional()
  @IsString()
  voiceMime?: string;

  @IsOptional()
  @IsNumber()
  voiceDurationSec?: number;
}

// Citizen asks to reopen — reason is MANDATORY (typed or voice). The request
// goes to a senior officer's quick desk review, never straight to reopen.
export class ReopenRequestDto {
  @IsOptional()
  @IsString()
  reason?: string; // typed reason, or the live transcript of the voice reason

  @IsOptional()
  @IsString()
  lang?: string;

  @IsOptional()
  @IsString()
  voiceBase64?: string;

  @IsOptional()
  @IsString()
  voiceMime?: string;

  @IsOptional()
  @IsNumber()
  voiceDurationSec?: number;
}

export class DeskReviewDecisionDto {
  @IsIn(['REOPEN', 'UPHOLD'])
  decision!: 'REOPEN' | 'UPHOLD';

  @IsString()
  @IsNotEmpty()
  note!: string;
}

export class VerificationDecisionDto {
  @IsString()
  @IsNotEmpty()
  deptId!: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsIn(CATEGORY_VALUES)
  category?: string;
}

export class CopilotAskDto {
  @IsString()
  @IsNotEmpty()
  question!: string;

  @IsOptional()
  @IsString()
  ysr?: string;

  @IsOptional()
  @IsString()
  lang?: string;
}

export class ConfirmClassificationDto {
  @IsString()
  @IsNotEmpty()
  deptId!: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  subSubjectId?: string;

  @IsIn(CATEGORY_VALUES)
  category!: string;
}

export class ActionDto {
  @IsIn(['ENQUIRY', 'ACTION_TAKEN', 'NOTE'])
  actionType!: string;

  @IsOptional()
  @IsString()
  noteTe?: string;

  @IsOptional()
  @IsString()
  noteEn?: string;

  @IsOptional()
  @IsBoolean()
  aiDrafted?: boolean;

  @IsOptional()
  @IsArray()
  evidenceIds?: string[];
}

export class ResolveDto {
  @IsString()
  @IsNotEmpty()
  resolutionNote!: string;

  @IsOptional()
  @IsArray()
  evidenceIds?: string[];
}

export class ReassignDto {
  @IsOptional()
  @IsString()
  officerId?: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class ReopenDto {
  @IsString()
  @IsNotEmpty()
  reasonTe!: string;

  @IsOptional()
  @IsString()
  reasonEn?: string;
}

export class ConfirmClosureDto {
  @IsBoolean()
  satisfied!: boolean;

  // For FINANCE grievances, closure also needs benefit-received confirmation.
  @IsOptional()
  @IsBoolean()
  benefitReceived?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class ForceCloseDto {
  @IsArray()
  evidenceIds!: string[];

  @IsString()
  @IsNotEmpty()
  justification!: string;
}

export class HoldDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class RejectDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class RerouteDto {
  @IsIn(['SERVICE_REQUEST', 'RTI', 'OTHER'])
  target!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class XroadLookupDto {
  @IsString()
  @IsNotEmpty()
  service!: string;
}

export class DraftAssistDto {
  @IsIn(['ACK', 'ENQUIRY_NOTE', 'RESOLUTION'])
  kind!: string;
}
