import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
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
  @IsString()
  @IsNotEmpty()
  mobile!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  aadhaar?: string;

  @IsOptional()
  @IsString()
  mandal?: string;

  @IsOptional()
  @IsString()
  secretariatCode?: string;

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

  @IsOptional()
  @IsLatitude()
  geoLat?: number;

  @IsOptional()
  @IsLongitude()
  geoLng?: number;
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
