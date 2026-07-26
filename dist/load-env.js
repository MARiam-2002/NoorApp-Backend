"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load .env file explicitly - load from project root
const envPath = path_1.default.resolve(process.cwd(), '.env');
dotenv_1.default.config({ path: envPath });
// Also load .env.development.local if it exists (Vercel development)
const devLocalPath = path_1.default.resolve(process.cwd(), '.env.development.local');
dotenv_1.default.config({ path: devLocalPath, override: true });
//# sourceMappingURL=load-env.js.map