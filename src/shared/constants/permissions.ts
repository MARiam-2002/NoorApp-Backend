export const Permissions = {
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  USERS_DELETE: 'users:delete',
  CONTENT_READ: 'content:read',
  CONTENT_WRITE: 'content:write',
  ADMIN_ACCESS: 'admin:access',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

export const PermissionList = Object.values(Permissions);
