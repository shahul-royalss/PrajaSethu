import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface SendInput {
  grievanceId?: string | null;
  channel?: 'SMS' | 'EMAIL' | 'IVR';
  to: string;
  template: string;
  body: string;
}

/**
 * Notification gateway, pilot implementation.
 * Real deployment wires this to an SMS/IVR provider + email. Here every message
 * is persisted to NotificationLog so the full "acknowledge → update → resolve"
 * loop is observable end-to-end without a live gateway (Blueprint B.8, H).
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async send(input: SendInput) {
    const log = await this.prisma.notificationLog.create({
      data: {
        grievanceId: input.grievanceId ?? null,
        channel: input.channel ?? 'SMS',
        to: maskMobile(input.to),
        template: input.template,
        body: input.body,
      },
    });
    this.logger.debug(`[${log.channel}] → ${log.to}: ${input.template}`);
    return log;
  }

  async listForGrievance(grievanceId: string) {
    return this.prisma.notificationLog.findMany({
      where: { grievanceId },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export function maskMobile(mobile: string): string {
  if (mobile.length < 4) return '****';
  return mobile.slice(0, 2) + 'XXXXXX' + mobile.slice(-2);
}
