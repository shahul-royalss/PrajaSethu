import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import Jimp from 'jimp';
import { PrismaService } from '../../prisma/prisma.service';
import { sha256 } from '../../common/util';

const MAX_B64 = 6 * 1024 * 1024; // ~4.5 MB file

export interface UploadInput {
  filename: string;
  mime: string;
  dataBase64: string; // raw base64 (no data: prefix)
}

/**
 * Document store, pilot implementation (Blueprint: MinIO/object store + signed URLs).
 * Files are kept as base64 in SQLite so the pilot needs no object store. Officers
 * can losslessly shrink image evidence with jimp (real server-side compression),
 * which matters for low-bandwidth Sachivalayam uploads.
 */
@Injectable()
export class AttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async add(grievanceId: string, input: UploadInput, uploadedBy: string, kind: string = 'DOCUMENT') {
    const g = await this.prisma.grievance.findUnique({ where: { id: grievanceId } });
    if (!g) {
      // also allow lookup by public YSR code
      const byYsr = await this.prisma.grievance.findUnique({ where: { ysr: grievanceId } });
      if (!byYsr) throw new NotFoundException('Grievance not found');
      grievanceId = byYsr.id;
    }
    const b64 = (input.dataBase64 || '').replace(/^data:[^;]+;base64,/, '');
    if (!b64) throw new BadRequestException('Empty file');
    if (b64.length > MAX_B64) throw new BadRequestException('File too large (max ~4.5 MB in the pilot).');
    const sizeBytes = Math.floor((b64.length * 3) / 4);
    return this.prisma.attachment.create({
      data: {
        grievanceId,
        type: kind,
        filename: input.filename?.slice(0, 200) ?? 'document',
        mime: input.mime ?? 'application/octet-stream',
        sizeBytes,
        originalSizeBytes: sizeBytes,
        dataBase64: b64,
        uploadedBy,
        // Full SHA-256 — the evidentiary fingerprint anchored to the audit ledger
        // (a truncated hash would weaken the "audio untouched" guarantee).
        hash: sha256(b64),
      },
      select: { id: true, type: true, filename: true, mime: true, sizeBytes: true, compressed: true, createdAt: true, hash: true },
    });
  }

  async list(grievanceId: string) {
    // Accept id or public YSR (the citizen-side player only knows the YSR).
    const g = await this.prisma.grievance.findUnique({ where: { id: grievanceId } });
    if (!g) {
      const byYsr = await this.prisma.grievance.findUnique({ where: { ysr: grievanceId } });
      if (byYsr) grievanceId = byYsr.id;
    }
    return this.prisma.attachment.findMany({
      where: { grievanceId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, type: true, filename: true, mime: true, sizeBytes: true, durationSec: true, originalSizeBytes: true,
        compressed: true, uploadedBy: true, createdAt: true, hash: true,
      },
    });
  }

  async content(attId: string) {
    const a = await this.prisma.attachment.findUnique({ where: { id: attId } });
    if (!a || !a.dataBase64) throw new NotFoundException('Attachment not found');
    return a;
  }

  /** Officer-side compression. Images are downscaled (never upscaled) + re-encoded
   * with jimp. We keep whichever is smaller, so compression can never enlarge a file. */
  async compress(attId: string) {
    const a = await this.prisma.attachment.findUnique({ where: { id: attId } });
    if (!a || !a.dataBase64) throw new NotFoundException('Attachment not found');
    if (a.compressed) throw new BadRequestException('Already compressed.');
    if (!(a.mime ?? '').startsWith('image/')) {
      throw new BadRequestException('Only image files can be compressed in the pilot.');
    }
    const before = a.sizeBytes ?? Math.floor((a.dataBase64.length * 3) / 4);
    const buf = Buffer.from(a.dataBase64, 'base64');

    let img: Jimp;
    try {
      img = await Jimp.read(buf);
    } catch {
      throw new BadRequestException('This image could not be read for compression.');
    }

    const MAX = 1600;
    // Downscale only — scaleToFit would upscale small images and inflate the file.
    if (img.bitmap.width > MAX || img.bitmap.height > MAX) {
      img.scaleToFit(MAX, MAX);
    }
    const out = await img.quality(60).getBufferAsync(Jimp.MIME_JPEG);

    // Never enlarge: if re-encoding didn't help, keep the original bytes.
    const reencodedSmaller = out.length < before;
    const b64 = reencodedSmaller ? out.toString('base64') : a.dataBase64;
    const after = reencodedSmaller ? out.length : before;
    const mime = reencodedSmaller ? 'image/jpeg' : a.mime ?? 'image/jpeg';
    const filename = reencodedSmaller
      ? (a.filename ?? 'image').replace(/\.[^.]+$/, '') + '.jpg'
      : a.filename ?? 'image';

    await this.prisma.attachment.update({
      where: { id: attId },
      data: {
        dataBase64: b64,
        mime,
        sizeBytes: after,
        originalSizeBytes: a.originalSizeBytes ?? before,
        compressed: true,
        filename,
      },
    });
    const saved = before > 0 ? Math.round(((before - after) / before) * 100) : 0;
    return { id: attId, beforeBytes: before, afterBytes: after, savedPercent: Math.max(saved, 0) };
  }
}
