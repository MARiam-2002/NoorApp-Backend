import dotenv from 'dotenv';
import path from 'path';

// Load .env file explicitly - load from project root
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

// Also load .env.development.local if it exists (Vercel development)
const devLocalPath = path.resolve(process.cwd(), '.env.development.local');
dotenv.config({ path: devLocalPath, override: true });
