import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { sha256 } from '../../common/util';

/**
 * Identity / Aadhaar handling, pilot implementation (Blueprint G.1, G.2, E.1).
 * Real deployment requires AUA/KUA registration + a UIDAI Aadhaar Data Vault.
 * The non-negotiable rule is honoured here: the RAW Aadhaar number is NEVER
 * stored or logged — only a vault token (a salted hash reference). Aadhaar is
 * PREFERRED, NOT REQUIRED, so a mobile-only citizen is fully supported.
 */
@Injectable()
export class IdentityService {
  // Demo salt only; real vault keys live in KMS/HSM (Blueprint G.2).
  private readonly vaultSalt = process.env.AADHAAR_VAULT_SALT ?? 'praja-setu-pilot-vault-salt';

  constructor(private readonly prisma: PrismaService) {}

  /** Convert a raw Aadhaar to a vault token reference. Raw value is discarded. */
  tokenize(aadhaar: string): { token: string; masked: string } {
    const digits = aadhaar.replace(/\D/g, '');
    if (digits.length !== 12) {
      throw new BadRequestException('Aadhaar must be 12 digits (it is tokenised and never stored raw).');
    }
    const token = `vault://aadhaar/${sha256(this.vaultSalt + digits).slice(0, 32)}`;
    return { token, masked: `XXXX-XXXX-${digits.slice(-4)}` };
  }

  /**
   * Resolve a petitioner for the assisted/self-serve path. eKYC OTP verification
   * happens in AuthService; here we find-or-create the Citizen with a tokenised
   * Aadhaar (if provided) — keyed by aadhaar token, else by mobile.
   */
  async resolveCitizen(input: {
    aadhaar?: string;
    mobile: string;
    name?: string;
    coName?: string;
    dob?: string;
    gender?: string;
    houseNo?: string;
    habitation?: string;
    village?: string;
    mandal?: string;
    district?: string;
    secretariatCode?: string;
    applicantType?: string;
    languagePref?: string;
    vulnerabilityFlags?: string[];
  }) {
    // Only set provided fields (don't overwrite existing data with undefined).
    const profile = {
      coName: input.coName,
      dob: input.dob,
      gender: input.gender,
      houseNo: input.houseNo,
      habitation: input.habitation,
      village: input.village,
      mandal: input.mandal,
      district: input.district,
      secretariatCode: input.secretariatCode,
      applicantType: input.applicantType,
      languagePref: input.languagePref,
    };
    const definedProfile = Object.fromEntries(Object.entries(profile).filter(([, v]) => v !== undefined));

    let aadhaarToken: string | undefined;
    if (input.aadhaar) {
      aadhaarToken = this.tokenize(input.aadhaar).token;
      const existing = await this.prisma.citizen.findUnique({ where: { aadhaarToken } });
      if (existing) return existing;
    }
    const byMobile = await this.prisma.citizen.findFirst({ where: { mobile: input.mobile } });
    if (byMobile) {
      return this.prisma.citizen.update({
        where: { id: byMobile.id },
        data: { ...definedProfile, ...(aadhaarToken && !byMobile.aadhaarToken ? { aadhaarToken } : {}) },
      });
    }
    return this.prisma.citizen.create({
      data: {
        aadhaarToken,
        mobile: input.mobile,
        name: input.name ?? 'Citizen',
        ...definedProfile,
        languagePref: input.languagePref ?? 'te',
        vulnerabilityFlags: JSON.stringify(input.vulnerabilityFlags ?? []),
      },
    });
  }
}
