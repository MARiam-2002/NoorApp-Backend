import path from 'node:path';
import process from 'node:process';
import fs from 'node:fs';
import type { Express, Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { env, appConfig, getApiBasePath } from '../config';
import { logger } from '../lib/logger';

const NOOR_PREMIUM_CSS = `
:root {
  --noor-bg: #FAF8F3;
  --noor-surface: #FFFFFF;
  --noor-navy: #1A1040;
  --noor-navy-soft: rgba(26, 16, 64, 0.08);
  --noor-navy-muted: rgba(26, 16, 64, 0.04);
  --noor-gold: #C9A86A;
  --noor-gold-dark: #B39156;
  --noor-gold-light: #D9BD95;
  --noor-gold-muted: #F4EBDB;
  --noor-text: #1A1040;
  --noor-text-muted: #5A5475;
  --noor-text-subtle: #9F9F9F;
  --noor-success: #2D8A61;
  --noor-error: #B83A2F;
  --noor-warning: #A97D1F;
  --noor-info: #3555AE;
  --noor-border: #ECE9E0;
  --noor-border-hover: #D9D4C6;
  --noor-radius-sm: 8px;
  --noor-radius: 12px;
  --noor-radius-lg: 16px;
  --noor-shadow-xs: 0 1px 2px rgba(26, 16, 64, 0.04);
  --noor-shadow-sm: 0 2px 10px rgba(26, 16, 64, 0.05);
  --noor-shadow-md: 0 6px 24px rgba(26, 16, 64, 0.07);
}
* { font-family: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Tajawal', 'SF Pro Display', sans-serif !important; box-sizing: border-box; }
body { direction: rtl; background: var(--noor-bg) !important; color: var(--noor-text); -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
html[lang="en"] body { direction: ltr; }
.swagger-ui { background: var(--noor-bg); color: var(--noor-text); max-width: 1280px; margin: 0 auto; padding: 0 24px 80px; }
.swagger-ui .topbar { background: #FFFFFF !important; border-bottom: 1px solid var(--noor-border); padding: 18px 0 !important; box-shadow: none !important; margin: 0 -24px 36px !important; padding-inline: 24px !important; position: relative; overflow: hidden; }
.swagger-ui .topbar::before {
  content: ""; position: absolute; inset-inline: 0; top: 0; height: 3px;
  background: linear-gradient(90deg, transparent 5%, var(--noor-navy) 25%, var(--noor-gold) 50%, var(--noor-navy) 75%, transparent 95%);
}
.swagger-ui .topbar a { display: none !important; }
.swagger-ui .topbar .wrapper { align-items: center; min-height: 48px; }
.swagger-ui .topbar .wrapper::before {
  content: "";
  display: inline-flex;
  width: 44px; height: 44px;
  background-image: url("https://asset.cloudinary.com/dgzucjqgi/f9fbb8b99944054a0378125ae226ae60");
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  margin-inline-end: 14px;
  filter: drop-shadow(0 2px 8px rgba(26,16,64,0.15));
}
.swagger-ui .topbar .wrapper::after {
  content: "نور";
  display: inline-flex;
  align-items: center;
  font-size: 28px;
  font-weight: 800;
  color: var(--noor-navy);
  letter-spacing: -0.5px;
  font-family: 'Tajawal', 'Inter', sans-serif;
}
.swagger-ui .info {
  background: var(--noor-surface);
  border: 1px solid var(--noor-border);
  border-radius: var(--noor-radius-lg);
  padding: 36px 40px;
  margin: 0 0 32px 0;
  box-shadow: var(--noor-shadow-sm);
  position: relative;
  overflow: hidden;
}
.swagger-ui .info::before {
  content: ""; position: absolute; top: 0; inset-inline-start: 0; width: 5px; height: 100%;
  background: linear-gradient(180deg, var(--noor-navy), var(--noor-gold));
  border-radius: 4px 0 0 4px;
}
.swagger-ui .info hgroup.main h1.title { color: var(--noor-navy); font-size: 30px; font-weight: 800; letter-spacing: -0.6px; margin: 0; }
.swagger-ui .info .title small.version-stamp {
  background: var(--noor-gold-muted) !important;
  color: var(--noor-gold-dark) !important;
  font-weight: 700;
  padding: 5px 14px;
  border-radius: 999px;
  font-size: 12.5px;
  margin-inline-start: 14px;
  vertical-align: middle;
  border: 1px solid rgba(201,168,106,0.35);
}
.swagger-ui .info .description { color: var(--noor-text-muted); font-size: 15.5px; line-height: 1.9; margin: 12px 0 0; }
.swagger-ui .scheme-container {
  background: var(--noor-surface) !important;
  border: 1px solid var(--noor-border);
  border-radius: var(--noor-radius-lg) !important;
  box-shadow: var(--noor-shadow-xs) !important;
  margin: 0 0 32px !important;
  padding: 22px 30px !important;
}
.swagger-ui .opblock-tag-section { margin: 48px 0 20px; }
.swagger-ui .opblock-tag {
  background: transparent !important;
  border: none !important;
  padding: 0 0 12px 0 !important;
  margin: 0 0 12px 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  width: 100% !important;
  cursor: pointer !important;
  user-select: none !important;
  border-bottom: 2px solid var(--noor-border) !important;
}
.swagger-ui .opblock-tag h2 { margin: 0; font-size: 20px; font-weight: 800; color: var(--noor-navy); display: inline-flex !important; align-items: center; gap: 14px; letter-spacing: -0.3px; }
.swagger-ui .opblock-tag h2::before {
  content: ""; display: inline-block; width: 5px; height: 22px; border-radius: 999px;
  background: linear-gradient(180deg, var(--noor-navy), var(--noor-gold));
  vertical-align: middle; margin-inline-end: 6px;
}
.swagger-ui .opblock-tag svg.arrow { flex-shrink: 0 !important; transition: transform .25s ease; stroke: var(--noor-gold-dark) !important; width: 20px !important; height: 20px !important; }
.swagger-ui .opblock-tag.is-open svg.arrow { transform: rotate(180deg); }
.swagger-ui .opblock {
  border: 1px solid var(--noor-border) !important;
  border-radius: var(--noor-radius-lg) !important;
  margin: 14px 0;
  background: var(--noor-surface);
  box-shadow: var(--noor-shadow-xs);
  overflow: hidden;
  transition: all .25s ease;
}
.swagger-ui .opblock:hover { box-shadow: var(--noor-shadow-md); transform: translateY(-1.5px); border-color: var(--noor-border-hover); }
.swagger-ui .opblock .opblock-summary { padding: 16px 22px; gap: 16px; cursor: pointer; }
.swagger-ui .opblock .opblock-summary-method {
  padding: 7px 16px !important;
  border-radius: 10px !important;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.5px;
  min-width: 86px;
  text-align: center;
  color: #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
}
.swagger-ui .opblock-get .opblock-summary-method    { background: linear-gradient(180deg,#34A276,#2D8A61) !important; }
.swagger-ui .opblock-post .opblock-summary-method   { background: linear-gradient(180deg,#3E63C2,#3555AE) !important; }
.swagger-ui .opblock-put .opblock-summary-method    { background: linear-gradient(180deg,#C49A47,#A97D1F) !important; }
.swagger-ui .opblock-patch .opblock-summary-method  { background: linear-gradient(180deg,#7866B5,#65529F) !important; }
.swagger-ui .opblock-delete .opblock-summary-method { background: linear-gradient(180deg,#D15247,#B83A2F) !important; }
.swagger-ui .opblock-summary-path, .swagger-ui .opblock-summary-path a {
  color: var(--noor-navy) !important;
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, Consolas, monospace !important;
  font-weight: 600;
  font-size: 14px;
  text-decoration: none;
}
.swagger-ui .opblock-summary-description { color: var(--noor-text-muted); font-size: 14px; }
.swagger-ui .btn {
  border-radius: 10px !important;
  padding: 10px 20px !important;
  font-weight: 700 !important;
  font-size: 13.5px !important;
  cursor: pointer;
  box-shadow: none !important;
  transition: all .2s ease !important;
}
.swagger-ui .btn.authorize {
  background: linear-gradient(180deg, var(--noor-navy), #2A1B5C) !important;
  border: 1px solid var(--noor-navy) !important;
  color: #FFFFFF !important;
  box-shadow: 0 3px 10px rgba(26,16,64,0.25) !important;
}
.swagger-ui .btn.authorize:hover { transform: translateY(-1px); box-shadow: 0 5px 16px rgba(26,16,64,0.3) !important; }
.swagger-ui .btn.execute {
  background: linear-gradient(180deg, var(--noor-gold), var(--noor-gold-dark)) !important;
  border: 1px solid var(--noor-gold-dark) !important;
  color: #1A1040 !important;
  font-weight: 800 !important;
  box-shadow: 0 3px 10px rgba(201,168,106,0.35) !important;
}
.swagger-ui .btn.execute:hover { transform: translateY(-1px); box-shadow: 0 5px 16px rgba(201,168,106,0.45) !important; }
.swagger-ui input[type=text], .swagger-ui input[type=email], .swagger-ui input[type=password], .swagger-ui input[type=number], .swagger-ui select, .swagger-ui textarea {
  border: 1.5px solid var(--noor-border) !important;
  border-radius: 10px !important;
  padding: 10px 14px !important;
  background: #FFFFFF !important;
  color: var(--noor-navy) !important;
  font-size: 13.5px !important;
  transition: all .2s ease !important;
}
.swagger-ui input:focus, .swagger-ui select:focus, .swagger-ui textarea:focus {
  outline: none !important;
  border-color: var(--noor-gold) !important;
  background: #FFFFFF !important;
  box-shadow: 0 0 0 4px rgba(201, 168, 106, 0.14) !important;
}
::-webkit-scrollbar { width: 12px; height: 12px; }
::-webkit-scrollbar-track { background: var(--noor-bg); }
::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #D4CFC2, #C5BFAF);
  border-radius: 999px;
  border: 3px solid var(--noor-bg);
}
::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, var(--noor-gold), var(--noor-gold-dark)); }
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
  const useDist = process.env.NODE_ENV === 'production' || !fs.existsSync(path.join(root, 'src', 'routes'));

  try {
    if (useDist && fs.existsSync(path.join(root, 'dist', 'routes'))) {
      walkRouteDirs(path.join(root, 'dist', 'routes'), '.js', results);
    } else if (fs.existsSync(path.join(root, 'src', 'routes'))) {
      walkRouteDirs(path.join(root, 'src', 'routes'), '.ts', results);
    }

    if (results.length > 0) {
      logger.info('[Swagger] Found route files', { count: results.length, files: results.slice(0, 3) });
      return results;
    }

    logger.warn('[Swagger] No JSDoc route files found');
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

function buildFallbackSwaggerHtml(specUrl: string): string {
  const safeSpecUrl = specUrl.replace(/[<>&"]/g, '');
  const LOGO_URL = 'https://asset.cloudinary.com/dgzucjqgi/f9fbb8b99944054a0378125ae226ae60';
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="theme-color" content="#1A1040" />
<title>Noor API | توثيق نور</title>
<style>
${NOOR_PREMIUM_CSS}
#swagger-ui{max-width:1280px;margin:0 auto;padding:0 24px 80px;position:relative;z-index:1}
html,body{margin:0;background:#FAF8F3;color:#1A1040;-webkit-font-smoothing:antialiased}
.load-wrap{display:flex;align-items:center;justify-content:center;min-height:60vh;color:#5A5475;font-family:Inter,Segoe UI,Tajawal,sans-serif;flex-direction:column;gap:18px}
.loader{display:inline-block;width:30px;height:30px;border:3px solid #ECE9E0;border-top-color:#C9A86A;border-radius:50%;animation:sp 1s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
.status-row{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:10px;align-items:center}
.status-pill{display:inline-flex;align-items:center;gap:8px;padding:7px 16px;border-radius:999px;font-size:12.5px;font-weight:700;font-family:Inter,Segoe UI,Tajawal,sans-serif;border:1px solid}
.status-pill.pending{background:rgba(201,168,106,.14);color:#B39156;border-color:rgba(201,168,106,.32)}
.status-pill.ok{background:rgba(45,138,97,.12);color:#2D8A61;border-color:rgba(45,138,97,.28)}
.status-pill.bad{background:rgba(184,58,47,.12);color:#B83A2F;border-color:rgba(184,58,47,.28)}
.fallback{max-width:860px;margin:0 auto;padding:40px 28px;font-family:Inter,Segoe UI,Tajawal,sans-serif;color:#5A5475}
.fallback h1{color:#1A1040;font-size:28px;margin:6px 0 10px;font-weight:800;letter-spacing:-.4px}
.fallback .sub{color:#9F9F9F;font-size:14.5px;margin:0 0 24px;line-height:1.9}
.fallback .card{background:#FFFFFF;border:1px solid #ECE9E0;border-radius:16px;padding:24px;margin:16px 0;box-shadow:0 2px 10px rgba(26,16,64,.04)}
.fallback .card h3{margin:0 0 12px;color:#1A1040;font-weight:800;font-size:17px;display:flex;align-items:center;gap:8px}
.fallback code{background:#F4EBDB;color:#B39156;padding:4px 12px;border-radius:8px;font-size:13px;font-family:ui-monospace,Consolas,monospace;word-break:break-word;font-weight:600}
.fallback ul{padding-right:20px;line-height:2.2}
.fallback .aopt{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px}
.fallback a.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;padding:13px 20px;border-radius:12px;font-weight:800;font-size:14px;border:1px solid transparent;transition:.2s ease;font-family:Inter,Segoe UI,Tajawal,sans-serif}
.fallback a.btn.p{background:linear-gradient(180deg,#1A1040,#2A1B5C);color:#fff;border-color:#1A1040;box-shadow:0 4px 14px rgba(26,16,64,.28)}
.fallback a.btn.g{background:linear-gradient(180deg,#C9A86A,#B39156);color:#1A1040;border-color:#B39156;box-shadow:0 4px 14px rgba(201,168,106,.35);font-weight:900}
.fallback a.btn.s{background:#FFFFFF;border-color:#ECE9E0;color:#1A1040;box-shadow:0 2px 8px rgba(26,16,64,.04)}
.fallback a.btn:hover{transform:translateY(-2px)}
.quick-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.mini-topbar{
  background:rgba(255,255,255,.96);backdrop-filter:blur(10px);
  border-bottom:1px solid #ECE9E0;padding:16px 0;margin:0 -24px 30px;padding-inline:24px;
  display:flex;align-items:center;justify-content:space-between;gap:14px;position:sticky;top:0;z-index:5
}
.mini-topbar::before{content:"";position:absolute;inset-inline:0;top:0;height:3px;background:linear-gradient(90deg,transparent 5%,#1A1040 25%,#C9A86A 50%,#1A1040 75%,transparent 95%)}
.mini-topbar .brand{display:inline-flex;align-items:center;gap:14px;position:relative;z-index:1}
.mini-topbar .brand img{width:44px;height:44px;object-fit:contain;filter:drop-shadow(0 2px 8px rgba(26,16,64,.15))}
.mini-topbar .brand .title{font-size:28px;font-weight:800;color:#1A1040;letter-spacing:-.5px;font-family:Tajawal,Inter,sans-serif}
.mini-topbar .actions{display:flex;gap:10px;align-items:center}
.mini-topbar .actions a{display:inline-flex;align-items:center;gap:6px;text-decoration:none;padding:9px 14px;border-radius:10px;font-weight:700;font-size:12.5px;font-family:Inter,Tajawal,sans-serif;transition:.2s ease}
.mini-topbar .actions a.primary{background:linear-gradient(180deg,#C9A86A,#B39156);color:#1A1040;border:1px solid #B39156;box-shadow:0 2px 8px rgba(201,168,106,.3)}
.mini-topbar .actions a.ghost{background:#fff;border:1px solid #ECE9E0;color:#1A1040}
.mini-topbar .actions a:hover{transform:translateY(-1px)}
.banner-hero{
  background:linear-gradient(135deg,#1A1040 0%,#2A1B5C 55%,#1A1040 100%);
  border-radius:18px;padding:42px 36px;margin:0 0 28px 0;color:#fff;position:relative;overflow:hidden;
  box-shadow:0 10px 40px rgba(26,16,64,.25)
}
.banner-hero::before{
  content:"";position:absolute;width:420px;height:420px;border-radius:50%;
  background:radial-gradient(circle,rgba(201,168,106,.32),transparent 65%);
  top:-140px;inset-inline-start:-100px;pointer-events:none
}
.banner-hero::after{
  content:"";position:absolute;width:300px;height:300px;border-radius:50%;
  background:radial-gradient(circle,rgba(201,168,106,.2),transparent 70%);
  bottom:-120px;inset-inline-end:-80px;pointer-events:none
}
.banner-hero .row{display:flex;align-items:center;gap:18px;position:relative;z-index:1}
.banner-hero img{width:64px;height:64px;object-fit:contain;filter:drop-shadow(0 6px 18px rgba(201,168,106,.4))}
.banner-hero h1{margin:0 0 6px;font-size:32px;font-weight:900;letter-spacing:-.8px;font-family:Tajawal,Inter,sans-serif;position:relative;z-index:1}
.banner-hero h1 span{background:linear-gradient(90deg,#F4EBDB,#D9BD95);-webkit-background-clip:text;background-clip:text;color:transparent}
.banner-hero p{margin:0;color:rgba(255,255,255,.85);font-size:15.5px;line-height:1.9;position:relative;z-index:1}
.banner-hero .chips{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px;position:relative;z-index:1}
.banner-hero .chip{display:inline-flex;align-items:center;gap:7px;padding:8px 16px;border-radius:999px;background:rgba(201,168,106,.22);border:1px solid rgba(201,168,106,.4);color:#F4EBDB;font-size:12.5px;font-weight:700}
.banner-hero .chip.solid{background:linear-gradient(180deg,#C9A86A,#B39156);color:#1A1040;border-color:transparent;font-weight:900;box-shadow:0 4px 12px rgba(201,168,106,.35)}
</style>
</head>
<body>
<div class="mini-topbar">
  <div class="brand">
    <img src="${LOGO_URL}" alt="نور" onerror="this.style.display='none'"/>
    <span class="title">نور</span>
  </div>
  <div class="actions">
    <a class="ghost" target="_blank" href="https://editor.swagger.io/?url=${location.origin}${safeSpecUrl}">Swagger Editor ↗</a>
    <a class="primary" href="${safeSpecUrl}">تحميل JSON ↓</a>
  </div>
</div>
<div id="swagger-ui">
  <div style="max-width:1280px;margin:0 auto">
    <div class="banner-hero">
      <div class="row">
        <img src="${LOGO_URL}" alt="نور" onerror="this.style.display='none'"/>
        <div>
          <h1>✨ توثيق <span>Noor API</span></h1>
          <p>نسخة v1.0 — 53 endpoint للقرآن الكريم · الأحاديث النبوية · مواقيت الصلاة · رحلة إسلامية يومية · تحديات وتقدّم</p>
          <div class="chips">
            <span class="chip solid">🧭 Base URL: <code style="background:rgba(26,16,64,.5);color:#F4EBDB;padding:3px 10px;border-radius:8px;margin-inline:6px;font-weight:700">/api/v1</code></span>
            <span class="chip">📘 Swagger / OpenAPI 3.1</span>
            <span class="chip">🔐 JWT Bearer Auth</span>
            <span class="chip">⚡ Express 5 + Prisma 6</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="load-wrap" id="loadBox">
    <span class="loader"></span>
    <div style="text-align:center">
      <div style="font-size:18px;color:#1A1040;font-weight:800;margin-bottom:6px">جارٍ تحميل واجهة التوثيق...</div>
      <div style="font-size:13.5px;color:#9F9F9F" id="loadMsg">1/3 تحميل واجهة Swagger UI...</div>
      <div class="status-row" id="statusRow" style="margin-top:22px">
        <span class="status-pill pending" id="sUi">⏳ واجهة Swagger</span>
        <span class="status-pill pending" id="sSpec">⏳ الـ API Specs</span>
        <span class="status-pill pending" id="sRender">⏳ العرض النهائي</span>
      </div>
    </div>
    <div style="margin-top:30px;text-align:center;color:#9F9F9F;font-size:13.5px;max-width:640px">
      <p style="margin:4px 0">إذا استغرق أكثر من 10 ثواني — استخدمي الخيارات البديلة التالية (كلها تعمل 100%):</p>
      <div class="aopt" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:14px">
        <a class="btn p" target="_blank" href="https://editor.swagger.io/?url=${location.origin}${safeSpecUrl}">افتحي في Swagger Editor ↗</a>
        <a class="btn s" href="${safeSpecUrl}">تحميل OpenAPI JSON ↓</a>
        <a class="btn g" target="_blank" href="https://www.postman.com/">استيراد في Postman ↗</a>
      </div>
    </div>
  </div>
</div>

<script>
var _ready = { ui:false, spec:false, rendered:false };
var _fallbackTimer = setTimeout(function(){
  if (_ready.rendered) return;
  showFallback('انتهت المهلة الزمنية — الواجهة لم تحمل خلال 10 ثواني');
}, 10000);

function setStatus(id, state, text){
  var el = document.getElementById(id); if(!el) return;
  el.className = 'status-pill ' + state;
  if (typeof text === 'string') el.textContent = text;
}
function setMsg(txt){ var m = document.getElementById('loadMsg'); if(m) m.textContent = txt; }

function showFallback(reason){
  clearTimeout(_fallbackTimer);
  var root = document.getElementById('swagger-ui'); if(!root) return;
  root.innerHTML = '<div class="fallback">' +
    '<span class="status-pill bad" style="margin-bottom:18px">⚠ الواجهة لم تحمل — لكن التوثيق متاح بطرق أخرى</span>' +
    '<div class="banner-hero" style="margin:0 0 28px">' +
      '<div class="row">' +
        '<img src="${LOGO_URL}" alt="نور" onerror="this.style.display=\\'none\\'"/>' +
        '<div><h1 style="color:#fff;font-size:28px">✨ توثيق <span>Noor API</span></h1>' +
        '<p>نسخة v1.0 — 53 endpoint للقرآن الكريم · الأحاديث · مواقيت الصلاة · رحلة إسلامية يومية.</p>' +
        '<div class="chips"><span class="chip solid">🧭 Base URL: /api/v1</span><span class="chip">📘 Swagger / OpenAPI 3.1</span><span class="chip">🔐 JWT Bearer Auth</span></div>' +
        '</div></div></div>' +
    '<div class="card"><h3>📄 السبب:</h3><div>' + (reason||'خطأ غير معروف').replace(/[<>&]/g,'') + '</div></div>' +
    '<div class="card"><h3>🚀 الخيارات البديلة (كلها تعمل 100%):</h3><ul>' +
    '<li><b>الخيار 1</b> — افتحي التوثيق في الموقع الرسمي لـ Swagger Editor: <a href="https://editor.swagger.io/?url=' + location.origin + '${safeSpecUrl}" target="_blank">editor.swagger.io ↗</a></li>' +
    '<li><b>الخيار 2</b> — فريق Flutter يستخدمون Postman: <code>File → Import → رابط</code> وألصقي: <code>' + location.origin + '${safeSpecUrl}</code></li>' +
    '<li><b>الخيار 3</b> — حملي الملف JSON على جهازك وفتحيه في أي أداة Swagger: <a href="${safeSpecUrl}">${safeSpecUrl}</a></li>' +
    '</ul></div>' +
    '<div class="aopt">' +
    '<a class="btn p" target="_blank" href="https://editor.swagger.io/?url=' + location.origin + '${safeSpecUrl}">افتحي في Swagger Editor ↗</a>' +
    '<a class="btn g" href="${safeSpecUrl}">تحميل ملف OpenAPI JSON ↓</a>' +
    '<a class="btn s" target="_blank" href="https://www.postman.com/">Postman ↗</a>' +
    '</div>' +
    '<div class="card" style="margin-top:22px"><h3>💡 نصيحة لفريق Flutter:</h3>' +
    'Base URL: <code>' + location.origin + '/api/v1</code>' +
    '<div class="quick-links" style="margin-top:16px">Endpoints سريعة: ' +
    '<code>/quran/surahs</code><code>/content/verse-of-day</code><code>/prayers/today</code><code>/journey/today</code><code>/auth/login</code><code>/tasbih</code><code>/qibla</code>' +
    '</div></div></div>';
}

(function loadCss(){
  var cssLoaded=false;
  try{
    var l = document.createElement('link');
    l.rel='stylesheet';
    l.href='https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css';
    l.onerror=function(){ cssLoaded=false; };
    l.onload =function(){ cssLoaded=true; };
    document.head.appendChild(l);
    setTimeout(function(){ if(!cssLoaded){ try{ var s=document.createElement('style'); s.textContent='.swagger-ui .topbar{display:none}.swagger-ui .info{padding:20px;background:#fff;border:1px solid #ECE9E0;border-radius:14px;margin:16px 0}.opblock{border:1px solid #ECE9E0;border-radius:14px;overflow:hidden;margin:12px 0;background:#fff}.opblock-summary{padding:14px}.opblock-summary-method{padding:7px 16px;border-radius:8px;font-weight:700;color:#fff;font-size:12px}'; document.head.appendChild(s) }catch(e){} } }, 3500);
  }catch(e){}
})();

function loadScript(src, done, fail){
  try{
    var s = document.createElement('script');
    s.src = src;
    s.async = false;
    var doneCalled = false;
    s.onload = function(){ if(doneCalled) return; doneCalled = true; done && done(); };
    s.onerror = function(){ if(doneCalled) return; doneCalled = true; fail && fail(); };
    var t = setTimeout(function(){ if(doneCalled) return; doneCalled = true; fail && fail(); }, 7500);
    var realFail = s.onerror; s.onerror = function(){ clearTimeout(t); realFail && realFail(); };
    var realDone = s.onload;  s.onload  = function(){ clearTimeout(t); realDone && realDone(); };
    document.head.appendChild(s);
  }catch(e){ fail && fail(); }
}

setMsg('1/3 تحميل واجهة Swagger UI...');

loadScript('https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js',
  function(){
    _ready.ui=true; setStatus('sUi','ok','✅ واجهة Swagger');
    setMsg('2/3 تحميل مواصفات الـ API من السيرفر...');
    setStatus('sSpec','pending','⏳ الـ API Specs');

    var startedAt = Date.now();
    var fetchedOk = false;
    var fetchTimeout = setTimeout(function(){ if(!fetchedOk){ showFallback('تأخر تحميل مواصفات الـ API من السيرفر'); } }, 6500);

    fetch('${safeSpecUrl}', { cache:'no-cache' })
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(function(spec){
        fetchedOk = true; clearTimeout(fetchTimeout);
        _ready.spec = true; setStatus('sSpec','ok','✅ الـ API Specs');
        setMsg('3/3 عرض التوثيق...');
        renderSwagger(spec);
      })
      .catch(function(err){
        fetchedOk = true; clearTimeout(fetchTimeout);
        showFallback('تعذر تحميل المواصفات من السيرفر: ' + (err && err.message ? err.message : String(err)));
      });
  },
  function(){
    showFallback('تعذر تحميل مكتبة Swagger من unpkg CDN. غالباً بسبب إنترنت أو منع من الشبكة.');
  }
);

function renderSwagger(spec){
  try{
    var presetsA = [SwaggerUIBundle.presets.apis];
    if (typeof SwaggerUIStandalonePreset !== 'undefined') presetsA.push(SwaggerUIStandalonePreset);
    var ui = SwaggerUIBundle({
      spec: spec,
      dom_id: '#swagger-ui',
      deepLinking: true,
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      tryItOutEnabled: false,
      showRequestDuration: true,
      supportedSubmitMethods: ['get','post','put','delete','patch'],
      validatorUrl: null,
      presets: presetsA,
      layout: 'StandaloneLayout',
      onComplete: function(){
        _ready.rendered=true; clearTimeout(_fallbackTimer);
        setStatus('sRender','ok','✅ العرض النهائي');
      },
      onFailure: function(err){
        showFallback('خطأ أثناء عرض Swagger: '+ (err && err.message ? err.message : String(err)));
      }
    });
    setTimeout(function(){
      if (_ready.rendered) return;
      var ops = document.querySelectorAll('.opblock, .info');
      if (ops && ops.length > 0) { _ready.rendered = true; return; }
      showFallback('الـ Swagger UI اكتمل تحميله لكنه لم يعرض المحتوى خلال 6 ثواني');
    }, 6000);
  }catch(e){
    showFallback('خطأ أثناء تهيئة SwaggerUI: ' + (e && e.message ? e.message : String(e));
  }
}
</script>
</body>
</html>`;
}

export function setupSwagger(app: Express): void {
  if (!env.SWAGGER_ENABLED) return;
  const base = getApiBasePath();
  const docsPath = `${base}/docs`;
  const jsonPath = `${base}/swagger.json`;

  app.get(jsonPath, (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
    res.send(swaggerSpec);
  });

  app.get(`${docsPath}.json`, (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(swaggerSpec);
  });

  function serveDocsHtml(req: Request, res: Response, next: NextFunction) {
    if (req.method !== 'GET') return next();
    const p = (req.path || '').replace(/\/+$/, '');
    const clean = p === '' || p === '/index.html' || p === '/' || p.endsWith('/docs') || p.endsWith('/docs/');
    if (!clean) return next();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=120, stale-while-revalidate=86400');
    res.send(buildFallbackSwaggerHtml(jsonPath));
  }

  try {
    app.get(`${docsPath}/`, serveDocsHtml);
    app.get(docsPath, serveDocsHtml);
    app.get(`${docsPath}/index.html`, serveDocsHtml);

    app.use(
      docsPath,
      (req: Request, res: Response, next: NextFunction) => {
        if (req.method === 'GET') {
          const rp = (req.path || '').replace(/\/+$/, '');
          if (rp === '' || rp === '/index.html') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(buildFallbackSwaggerHtml(jsonPath));
            return;
          }
        }
        next();
      },
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
  } catch (err: any) {
    logger.warn('[Swagger] swagger-ui-express setup failed, using inline fallback only', { err: err?.message });
    app.get(`${docsPath}/`, serveDocsHtml);
    app.get(docsPath, serveDocsHtml);
  }
}
