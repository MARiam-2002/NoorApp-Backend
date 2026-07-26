import { UserRole } from '@prisma/client';

export const Roles = UserRole;

export type Role = UserRole;

export const RoleList = Object.values(UserRole);
