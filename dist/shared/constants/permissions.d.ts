export declare const Permissions: {
    readonly USERS_READ: "users:read";
    readonly USERS_WRITE: "users:write";
    readonly USERS_DELETE: "users:delete";
    readonly CONTENT_READ: "content:read";
    readonly CONTENT_WRITE: "content:write";
    readonly ADMIN_ACCESS: "admin:access";
};
export type Permission = (typeof Permissions)[keyof typeof Permissions];
export declare const PermissionList: ("users:read" | "users:write" | "users:delete" | "content:read" | "content:write" | "admin:access")[];
//# sourceMappingURL=permissions.d.ts.map