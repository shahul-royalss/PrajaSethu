import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { parseJson } from '../../common/util';

/**
 * Auth, pilot implementation.
 *  - Officers: username/password → JWT, standing in for Keycloak OIDC + MFA (G.1).
 *  - Citizens: mobile OTP → JWT, standing in for UIDAI eKYC OTP, with mobile-only
 *    fallback so non-Aadhaar citizens are never excluded (G.1, B.5).
 */
@Injectable()
export class AuthService {
  private readonly exposeMockOtp = process.env.EXPOSE_MOCK_OTP === 'true';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly notifications: NotificationService,
  ) {}

  async officerLogin(username: string, password: string) {
    const officer = await this.prisma.officer.findUnique({ where: { username } });
    if (!officer || !officer.active) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, officer.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const payload = {
      sub: officer.id,
      kind: 'OFFICER',
      role: officer.role,
      designation: officer.designation,
      deptId: officer.deptId,
      level: officer.level,
      jurisdiction: parseJson<{ mandal?: string; secretariatCodes?: string[] }>(officer.jurisdiction, {}),
      name: officer.name,
    };
    return {
      accessToken: await this.jwt.signAsync(payload),
      officer: {
        id: officer.id, name: officer.name, role: officer.role,
        designation: officer.designation, deptId: officer.deptId, level: officer.level,
      },
    };
  }

  async requestOtp(mobile: string) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.prisma.otp.create({ data: { mobile, code, expiresAt } });
    await this.notifications.send({
      to: mobile,
      template: 'OTP',
      body: `Your SAARTHI OTP is ${code}. Valid 10 minutes.`,
    });
    return {
      sent: true,
      mobileMasked: mobile.slice(0, 2) + 'XXXXXX' + mobile.slice(-2),
      // Pilot-only convenience so the demo works without a live SMS gateway.
      ...(this.exposeMockOtp ? { devCode: code } : {}),
    };
  }

  async verifyOtp(mobile: string, code: string, name?: string) {
    const otp = await this.prisma.otp.findFirst({
      where: { mobile, consumed: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.code !== code || otp.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    await this.prisma.otp.update({ where: { id: otp.id }, data: { consumed: true } });

    let citizen = await this.prisma.citizen.findFirst({ where: { mobile } });
    if (!citizen) {
      citizen = await this.prisma.citizen.create({ data: { mobile, name: name ?? 'Citizen' } });
    }
    const payload = { sub: citizen.id, kind: 'CITIZEN', mobile: citizen.mobile, name: citizen.name };
    return {
      accessToken: await this.jwt.signAsync(payload),
      citizen: { id: citizen.id, name: citizen.name, mobileMasked: mobile.slice(0, 2) + 'XXXXXX' + mobile.slice(-2) },
    };
  }
}
