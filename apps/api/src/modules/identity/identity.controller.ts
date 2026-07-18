import { Body, Controller, ForbiddenException, Get, NotFoundException, Patch } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { IdentityService } from './identity.service';
import { AuthUser, CurrentUser } from '../../common/auth/current-user.decorator';

class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(120) coName?: string;
  @IsOptional() @IsString() @MaxLength(10) dob?: string;
  @IsOptional() @IsIn(['MALE', 'FEMALE', 'OTHER']) gender?: string;
  @IsOptional() @IsString() @MaxLength(40) houseNo?: string;
  @IsOptional() @IsString() @MaxLength(120) habitation?: string;
  @IsOptional() @IsString() @MaxLength(120) village?: string;
  @IsOptional() @IsString() @MaxLength(120) mandal?: string;
  @IsOptional() @IsString() @MaxLength(120) district?: string;
  @IsOptional() @IsString() @MaxLength(10) languagePref?: string;
}

function publicProfile(c: {
  id: string; name: string; coName: string | null; dob: string | null; gender: string | null;
  mobile: string; houseNo: string | null; habitation: string | null; village: string | null;
  mandal: string | null; district: string | null; languagePref: string;
}) {
  return {
    id: c.id,
    name: c.name,
    coName: c.coName,
    dob: c.dob,
    gender: c.gender,
    mobileMasked: c.mobile.slice(0, 2) + 'XXXXXX' + c.mobile.slice(-2),
    houseNo: c.houseNo,
    habitation: c.habitation,
    village: c.village,
    mandal: c.mandal,
    district: c.district,
    languagePref: c.languagePref,
    profileComplete: !!(c.name && c.name !== 'Citizen' && c.village && c.mandal && c.district),
  };
}

/** The citizen's own profile: collected once on first login, editable any time
 *  from the dashboard — never re-asked at complaint time. */
@Controller('identity')
export class IdentityController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
  ) {}

  @Get('me')
  async me(@CurrentUser() actor: AuthUser) {
    if (actor?.kind !== 'CITIZEN') throw new ForbiddenException('Citizen sign-in required.');
    const c = await this.prisma.citizen.findUnique({ where: { id: actor.sub } });
    if (!c) throw new NotFoundException('Citizen not found');
    return publicProfile(c);
  }

  @Patch('me')
  async update(@CurrentUser() actor: AuthUser, @Body() dto: UpdateProfileDto) {
    if (actor?.kind !== 'CITIZEN') throw new ForbiddenException('Citizen sign-in required.');
    const updated = await this.identity.attachToCitizen(actor.sub, dto);
    if (!updated) throw new NotFoundException('Citizen not found');
    const c = await this.prisma.citizen.findUnique({ where: { id: actor.sub } });
    return publicProfile(c!);
  }
}
