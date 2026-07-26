"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleList = exports.Roles = void 0;
const client_1 = require("@prisma/client");
exports.Roles = client_1.UserRole;
exports.RoleList = Object.values(client_1.UserRole);
//# sourceMappingURL=roles.js.map