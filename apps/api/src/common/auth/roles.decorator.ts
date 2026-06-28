import { SetMetadata } from '@nestjs/common';
import { Role } from '../constants';

export const ROLES_KEY = 'requiredRoles';
// RBAC: restrict a route to one or more officer roles.
export const RequireRoles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
