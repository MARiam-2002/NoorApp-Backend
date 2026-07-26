#!/usr/bin/env node

/**
 * Prisma migration script for Vercel deployment
 * Runs pending migrations against the connected database
 */

import { execSync } from 'child_process';

const isProduction = process.env.NODE_ENV === 'production';

console.log('[Migration] Starting Prisma migrations...');
console.log(`[Migration] Environment: ${isProduction ? 'production' : 'development'}`);

try {
  // Run migrations with deploy (production-safe, no prompts)
  const cmd = isProduction 
    ? 'npx prisma migrate deploy'
    : 'npx prisma migrate dev --skip-generate';
  
  console.log(`[Migration] Running: ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
  
  console.log('[Migration] ✓ Migrations completed successfully');
  process.exit(0);
} catch (error) {
  console.error('[Migration] ✗ Migration failed:', error.message);
  
  // In production, we want to know if migrations failed
  if (isProduction) {
    console.error('[Migration] ERROR: Database migrations failed in production');
    process.exit(1);
  }
  
  // In development, warn but don't fail the entire build
  console.warn('[Migration] WARNING: Migrations failed in development mode');
  process.exit(0);
}
