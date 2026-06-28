import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

// Attaches req.user if a valid bearer token is present, but never rejects.
// Used for intake, which is reachable both self-serve (no token) and DA-assisted (token).
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers['authorization'];
    if (header && typeof header === 'string') {
      const [type, value] = header.split(' ');
      if (type === 'Bearer' && value) {
        try {
          (request as any).user = await this.jwt.verifyAsync(value);
        } catch {
          /* ignore — anonymous intake is allowed */
        }
      }
    }
    return true;
  }
}
