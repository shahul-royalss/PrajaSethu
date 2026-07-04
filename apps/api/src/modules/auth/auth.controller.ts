import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from '../../common/auth/public.decorator';
import { RequireRoles } from '../../common/auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/constants';

class OfficerLoginDto {
  @IsString() @IsNotEmpty() username!: string;
  @IsString() @IsNotEmpty() password!: string;
}
class RequestOtpDto {
  @IsString() @IsNotEmpty() mobile!: string;
}
class VerifyOtpDto {
  @IsString() @IsNotEmpty() mobile!: string;
  @IsString() @IsNotEmpty() code!: string;
  @IsOptional() @IsString() name?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('officer/login')
  officerLogin(@Body() dto: OfficerLoginDto) {
    return this.auth.officerLogin(dto.username, dto.password);
  }

  @Public()
  @Post('citizen/request-otp')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.mobile);
  }

  @Public()
  @Post('citizen/verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.mobile, dto.code, dto.name);
  }

  @RequireRoles(Roles.DA, Roles.OFFICER, Roles.SUPERVISOR, Roles.COLLECTOR, Roles.AUDITOR)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
