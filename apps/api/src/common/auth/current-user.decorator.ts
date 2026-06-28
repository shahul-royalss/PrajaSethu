import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  sub: string; // officer id or citizen id
  kind: 'OFFICER' | 'CITIZEN';
  role?: string; // officer role
  deptId?: string | null;
  level?: number;
  jurisdiction?: { mandal?: string; secretariatCodes?: string[] };
  mobile?: string;
  name?: string;
}

// Pulls the authenticated principal that JwtAuthGuard attached to the request.
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user as AuthUser;
});
