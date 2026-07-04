import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { IsNotEmpty, IsString } from 'class-validator';
import { AttachmentsService } from './attachments.service';
import { Public } from '../../common/auth/public.decorator';
import { OptionalAuthGuard } from '../../common/auth/optional-auth.guard';
import { CurrentUser, AuthUser } from '../../common/auth/current-user.decorator';
import { RequireRoles } from '../../common/auth/roles.decorator';
import { Roles } from '../../common/constants';

class UploadDto {
  @IsString() @IsNotEmpty() filename!: string;
  @IsString() @IsNotEmpty() mime!: string;
  @IsString() @IsNotEmpty() dataBase64!: string;
}

@Controller('grievances')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  // Citizen (or DA) attaches a document — accepts a citizen/DA token or anonymous (by id/YSR).
  @Public()
  @UseGuards(OptionalAuthGuard)
  @Post(':id/attachments')
  add(@Param('id') id: string, @Body() dto: UploadDto, @CurrentUser() actor?: AuthUser) {
    return this.attachments.add(id, dto, actor?.role ?? actor?.kind ?? 'CITIZEN');
  }

  @Public()
  @Get(':id/attachments')
  list(@Param('id') id: string) {
    return this.attachments.list(id);
  }

  // Inline content for viewing/downloading.
  @Public()
  @Get(':id/attachments/:attId/content')
  async content(@Param('attId') attId: string, @Res() res: Response) {
    const a = await this.attachments.content(attId);
    const buf = Buffer.from(a.dataBase64 as string, 'base64');
    res.setHeader('Content-Type', a.mime ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${a.filename ?? 'document'}"`);
    res.send(buf);
  }

  // Officer-side compression at the workbench.
  @RequireRoles(Roles.OFFICER, Roles.SUPERVISOR, Roles.COLLECTOR, Roles.DA)
  @Post(':id/attachments/:attId/compress')
  compress(@Param('attId') attId: string) {
    return this.attachments.compress(attId);
  }
}
