import path from 'node:path';
import process from 'node:process';
import fs from 'node:fs';
import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { env, appConfig, getApiBasePath } from '../config';
import { logger } from '../lib/logger';

const NOOR_PREMIUM_CSS = `
:root {
  --noor-bg: #FAFAF8;
  --noor-surface: #FFFFFF;
  --noor-gold: #C9A46E;
  --noor-gold-dark: #B08F56;
  --noor-gold-light: #D9C39A;
  --noor-gold-muted: #F3ECDD;
  --noor-text: #1A1816;
  --noor-text-muted: #65605B;
  --noor-text-subtle: #8A8580;
  --noor-success: #1F8A59;
  --noor-error: #BD3B2F;
  --noor-warning: #B38521;
  --noor-info: #2D5FB0;
  --noor-border: #EDE9E0;
  --noor-border-hover: #E0D9CC;
  --noor-radius-sm: 6px;
  --noor-radius: 10px;
  --noor-radius-lg: 12px;
  --noor-shadow-xs: 0 1px 2px rgba(26, 24, 22, 0.04);
  --noor-shadow-sm: 0 2px 8px rgba(26, 24, 22, 0.05);
  --noor-shadow-md: 0 4px 16px rgba(26, 24, 22, 0.06);
}
* { font-family: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Tajawal', 'SF Pro Display', sans-serif !important; box-sizing: border-box; }
body { direction: rtl; background: var(--noor-bg) !important; color: var(--noor-text); -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
html[lang="en"] body { direction: ltr; }
.swagger-ui { background: var(--noor-bg); color: var(--noor-text); max-width: 1280px; margin: 0 auto; padding: 0 24px 80px; }
.swagger-ui .topbar { background: #FFFFFF !important; border-bottom: 1px solid var(--noor-border); padding: 14px 0; box-shadow: none; margin: 0 -24px 32px; padding-inline: 24px; }
.swagger-ui .topbar::after { content: ""; position: absolute; inset-inline: 0; top: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--noor-gold) 20%, var(--noor-gold) 80%, transparent); }
.swagger-ui .topbar a { display: none !important; }
.swagger-ui .topbar::before { content: "نور"; display: block; font-size: 26px; font-weight: 800; color: var(--noor-gold); letter-spacing: -0.8px; font-family: 'Tajawal', 'Inter', sans-serif; }
.swagger-ui .topbar .wrapper { align-items: center; }
.swagger-ui .info { background: var(--noor-surface); border: 1px solid var(--noor-border); border-radius: var(--noor-radius-lg); padding: 32px 36px; margin: 0 0 32px 0; box-shadow: var(--noor-shadow-xs); }
.swagger-ui .info hgroup.main h1.title { color: var(--noor-text); font-size: 28px; font-weight: 700; letter-spacing: -0.4px; margin: 0; }
.swagger-ui .info .title small.version-stamp { background: var(--noor-gold-muted) !important; color: var(--noor-gold-dark) !important; font-weight: 600; padding: 4px 12px; border-radius: 999px; font-size: 12px; margin-inline-start: 12px; vertical-align: middle; }
.swagger-ui .info .description { color: var(--noor-text-muted); font-size: 15px; line-height: 1.8; margin: 8px 0 0; }
.swagger-ui .scheme-container { background: var(--noor-surface) !important; border: 1px solid var(--noor-border); border-radius: var(--noor-radius-lg); box-shadow: var(--noor-shadow-xs) !important; margin: 0 0 32px !important; padding: 20px 28px !important; }
.swagger-ui .opblock-tag-section { margin: 40px 0 16px; }
.swagger-ui .opblock-tag { background: transparent !important; border: none !important; padding: 0 0 8px 0 !important; margin: 0 0 8px 0 !important; display: flex !important; align-items: center !important; justify-content: space-between !important; width: 100% !important; cursor: pointer !important; user-select: none !important; border-bottom: 1px solid var(--noor-border) !important; }
.swagger-ui .opblock-tag h2 { margin: 0; font-size: 18px; font-weight: 700; color: var(--noor-text); display: inline-flex !important; align-items: baseline; gap: 12px; }
.swagger-ui .opblock-tag h2::before { content: ""; display: inline-block; width: 4px; height: 18px; border-radius: 999px; background: var(--noor-gold); vertical-align: middle; margin-inline-end: 8px; }
.swagger-ui .opblock-tag svg.arrow { flex-shrink: 0 !important; transition: transform .2s ease; stroke: var(--noor-gold-dark) !important; width: 18px !important; height: 18px !important; }
.swagger-ui .opblock-tag.is-open svg.arrow { transform: rotate(180deg); }
.swagger-ui .opblock { border: 1px solid var(--noor-border) !important; border-radius: var(--noor-radius-lg) !important; margin: 12px 0; background: var(--noor-surface); box-shadow: var(--noor-shadow-xs); overflow: hidden; }
.swagger-ui .opblock .opblock-summary { padding: 14px 20px; gap: 14px; cursor: pointer; }
.swagger-ui .opblock .opblock-summary-method { padding: 6px 14px !important; border-radius: var(--noor-radius-sm) !important; font-weight: 600; font-size: 11.5px; letter-spacing: 0.4px; min-width: 78px; text-align: center; color: #fff; }
.swagger-ui .opblock-get .opblock-summary-method { background: var(--noor-success) !important; }
.swagger-ui .opblock-post .opblock-summary-method { background: var(--noor-info) !important; }
.swagger-ui .opblock-put .opblock-summary-method { background: var(--noor-warning) !important; }
.swagger-ui .opblock-patch .opblock-summary-method { background: #6C5AA8 !important; }
.swagger-ui .opblock-delete .opblock-summary-method { background: var(--noor-error) !important; }
.swagger-ui .opblock-summary-path, .swagger-ui .opblock-summary-path a { color: var(--noor-text) !important; font-family: 'JetBrains Mono', 'Fira Code', monospace !important; font-weight: 500; font-size: 13.5px; text-decoration: none; }
.swagger-ui .opblock-summary-description { color: var(--noor-text-muted); font-size: 13.5px; }
.swagger-ui .btn { border-radius: var(--noor-radius-sm) !important; padding: 8px 18px !important; font-weight: 600 !important; font-size: 13px !important; cursor: pointer; box-shadow: none !important; }
.swagger-ui .btn.authorize { background: var(--noor-gold) !important; border: 1px solid var(--noor-gold-dark) !important; color: #FFFFFF !important; }
.swagger-ui .btn.execute { background: var(--noor-text) !important; border: 1px solid var(--noor-text) !important; color: #FFFFFF !important; }
.swagger-ui input[type=text], .swagger-ui input[type=email], .swagger-ui input[type=password], .swagger-ui input[type=number], .swagger-ui select, .swagger-ui textarea { border: 1px solid var(--noor-border) !important; border-radius: var(--noor-radius-sm) !important; padding: 9px 12px !important; background: var(--noor-bg) !important; color: var(--noor-text) !important; font-size: 13px !important; }
.swagger-ui input:focus, .swagger-ui select:focus, .swagger-ui textarea:focus { outline: none !important; border-color: var(--noor-gold) !important; background: #FFFFFF !important; box-shadow: 0 0 0 3px rgba(201, 164, 110, 0.12) !important; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: var(--noor-bg); }
::-webkit-scrollbar-thumb { background: #D8D1C4; border-radius: 999px; border: 2px solid var(--noor-bg); }
::-webkit-scrollbar-thumb:hover { background: var(--noor-gold); }
`;

function walkRouteDirs(dir: string, ext: string, results: string[]): void {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && !e.isSymbolicLink()) { walkRouteDirs(full, ext, results); continue; }
    if (!e.isFile() || !full.endsWith(ext)) continue;
    const normalized = full.split(path.sep).join('/');
    if (!results.includes(normalized)) results.push(normalized);
  }
}

function resolveSwaggerFiles(): string[] {
  const root = process.cwd();
  const results: string[] = [];
  try {
    // First, try to find TypeScript source files (development mode)
    if (fs.existsSync(path.join(root, 'src', 'routes'))) {
      walkRouteDirs(path.join(root, 'src', 'routes'), '.ts', results);
      logger.debug('[Swagger] Source TS files matched', { count: results.length });
    }
    
    // If no TS files found or in production, look for compiled JS files
    if (results.length === 0 && fs.existsSync(path.join(root, 'dist', 'routes'))) {
      walkRouteDirs(path.join(root, 'dist', 'routes'), '.js', results);
      logger.debug('[Swagger] Compiled JS files matched', { count: results.length });
    }
    
    if (results.length > 0) {
      logger.info('[Swagger] Found route files', { count: results.length, files: results.slice(0, 3) });
      return results;
    }
    
    logger.warn('[Swagger] No JSDoc route files found - returning empty spec paths');
    return [];
  } catch (err) {
    logger.error('[Swagger] resolveSwaggerFiles failed', { err });
    return [];
  }
}

function buildSwaggerSpec() {
  const apiBasePath = getApiBasePath();
  const definition = {
    openapi: '3.1.0',
    info: {
      title: env.SWAGGER_TITLE,
      version: env.SWAGGER_VERSION,
      description: env.SWAGGER_DESCRIPTION,
      contact: { name: 'Noor Support', email: 'support@noor.app' },
    },
    servers: [
      { url: apiBasePath, description: 'API v1 (Production)' },
      { url: 'http://localhost:3000/api/v1', description: 'Local Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer Token - أضف التوكن بدون البادئة Bearer',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation completed successfully' },
            data: { type: 'object' },
            meta: { type: 'object', nullable: true },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            message: { type: 'string', example: 'Invalid input provided' },
            details: { type: 'array', items: { type: 'object' }, nullable: true },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'المصادقة وتسجيل الدخول والاشتراك' },
      { name: 'Dashboard', description: 'الشاشة الرئيسية' },
      { name: 'Prayers', description: 'أوقات الصلاة' },
      { name: 'Tasbih', description: 'المسبحة الإلكترونية' },
      { name: 'Qibla', description: 'اتجاه القبلة' },
      { name: 'Journey', description: 'رحلتي اليومية' },
      { name: 'Quran', description: 'القرآن الكريم' },
      { name: 'Challenges', description: 'التحديات' },
      { name: 'Content', description: 'المحتوى اليومي' },
      { name: 'Notifications', description: 'الإشعارات' },
      { name: 'Profile', description: 'الملف الشخصي' },
      { name: 'Health', description: 'فحص حالة الخدمة' },
    ],
  } as const;
  const apis = resolveSwaggerFiles();
  try {
    const spec = swaggerJsdoc({ definition, apis }) as any;
    logger.info('[Swagger] Spec built', { routes: Object.keys(spec.paths || {}).length });
    return spec;
  } catch (err: any) {
    logger.warn('[Swagger] Bulk parse failed', { err: err?.message });
    return { ...(definition as any), paths: {} };
  }
}

export const swaggerSpec = buildSwaggerSpec();

export function setupSwagger(app: Express): void {
  if (!env.SWAGGER_ENABLED) return;
  const docsPath = `${getApiBasePath()}/docs`;
  app.use(
    docsPath,
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: `${env.SWAGGER_TITLE} | توثيق API`,
      customCss: NOOR_PREMIUM_CSS,
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        filter: true,
        tryItOutEnabled: false,
        showRequestDuration: true,
        deepLinking: true,
        supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
        validatorUrl: null,
      },
    }),
  );
  app.get(`${docsPath}.json`, (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(swaggerSpec);
  });
}
