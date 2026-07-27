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
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="theme-color" content="#C9A46E" />
<title>Noor API | توثيق API</title>
<style>
${NOOR_PREMIUM_CSS}
#swagger-ui{max-width:1280px;margin:0 auto;padding:0 24px 80px;position:relative;z-index:1}
html,body{margin:0;background:#FAFAF8;color:#1A1816}
.load-wrap{display:flex;align-items:center;justify-content:center;min-height:60vh;color:#8A8580;font-family:Inter,Segoe UI,Tajawal,sans-serif;flex-direction:column;gap:16px}
.loader{display:inline-block;width:26px;height:26px;border:3px solid #EDE9E0;border-top-color:#C9A46E;border-radius:50%;animation:sp 1s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
.status-row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:8px;align-items:center}
.status-pill{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;font-family:Inter,Segoe UI,Tajawal,sans-serif;border:1px solid}
.status-pill.pending{background:rgba(201,164,110,.12);color:#B08F56;border-color:rgba(201,164,110,.3)}
.status-pill.ok{background:rgba(31,138,89,.12);color:#1F8A59;border-color:rgba(31,138,89,.3)}
.status-pill.bad{background:rgba(189,59,47,.12);color:#BD3B2F;border-color:rgba(189,59,47,.3)}
.fallback{max-width:820px;margin:0 auto;padding:40px 28px;font-family:Inter,Segoe UI,Tajawal,sans-serif;color:#65605B}
.fallback h1{color:#1A1816;font-size:24px;margin:0 0 8px}
.fallback .sub{color:#8A8580;font-size:14.5px;margin:0 0 24px;line-height:1.8}
.fallback .card{background:#FFFFFF;border:1px solid #EDE9E0;border-radius:14px;padding:22px;margin:14px 0}
.fallback code{background:#F3ECDD;color:#B08F56;padding:3px 10px;border-radius:6px;font-size:13px;font-family:ui-monospace,Consolas,monospace;word-break:break-word}
.fallback a.opt{display:flex;gap:14px;flex-wrap:wrap;margin-top:16px}
.fallback a.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:700;border:1px solid transparent;transition:.2s ease}
.fallback a.btn.p{background:linear-gradient(180deg,#C9A46E,#B08F56);color:#fff;border-color:#B08F56}
.fallback a.btn.s{background:#FFFFFF;border-color:#EDE9E0;color:#1A1816}
.fallback a.btn:hover{transform:translateY(-2px)}
.fallback ul{padding-right:20px;line-height:2}
.quick-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.mini-topbar{background:#fff;border-bottom:1px solid #EDE9E0;padding:14px 0;margin:0 -24px 28px;padding-inline:24px;display:flex;align-items:center;justify-content:space-between;gap:14px;position:sticky;top:0;z-index:5;backdrop-filter:blur(6px);background:rgba(255,255,255,.92)}
.mini-topbar .logo{font-size:26px;font-weight:800;color:#C9A46E;letter-spacing:-.8px;font-family:Tajawal,Inter,sans-serif}
</style>
</head>
<body>
<div class="mini-topbar">
  <div class="logo">نور</div>
  <div class="quick-links">
    <a class="btn s" style="padding:6px 12px;border:1px solid #EDE9E0;border-radius:10px;background:#fff;color:#1A1816;font-size:12px;font-family:Inter,Tajawal,sans-serif;text-decoration:none;font-weight:600" href="${safeSpecUrl}">تحميل OpenAPI JSON ↓</a>
  </div>
</div>
<div id="swagger-ui">
  <div class="load-wrap" id="loadBox">
    <span class="loader"></span>
    <div style="text-align:center">
      <div style="font-size:17px;color:#1A1816;font-weight:700;margin-bottom:6px">جارٍ تحميل توثيق Noor API...</div>
      <div style="font-size:13px;color:#8A8580" id="loadMsg">1/3 تحميل الواجهة...</div>
      <div class="status-row" id="statusRow" style="margin-top:20px">
        <span class="status-pill pending" id="sUi">⏳ واجهة Swagger</span>
        <span class="status-pill pending" id="sSpec">⏳ الـ API Specs</span>
        <span class="status-pill pending" id="sRender">⏳ العرض النهائي</span>
      </div>
    </div>
    <div style="margin-top:26px;text-align:center;color:#8A8580;font-size:13px">
      <p style="margin:4px 0">إذا استغرق أكثر من 10 ثواني — استخدمي الخيارات البديلة أدناه:</p>
      <div class="fallback" style="padding:18px;margin-top:10px;box-shadow:none;background:#fff;border:1px solid #EDE9E0;border-radius:14px;max-width:520px">
        <div class="aopt" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          <a class="btn p" target="_blank" style="padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:700;background:#C9A46E;color:#fff;border:1px solid #B08F56" href="https://editor.swagger.io/?url=${location.origin}${safeSpecUrl}">افتحي في Swagger Editor ↗</a>
          <a class="btn s" style="padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:700;background:#fff;border:1px solid #EDE9E0;color:#1A1816" href="${safeSpecUrl}">تحميل JSON ↓</a>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
// ---------- STEP 1: Force-fail gracefully if nothing happens after 10s ----------
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
    '<span class="status-pill bad" style="margin-bottom:16px">⚠ الواجهة لم تحمل — لكن التوثيق متاح بطرق أخرى</span>' +
    '<h1 style="font-size:28px;margin:6px 0">توثيق Noor API</h1>' +
    '<p class="sub">نسخة v1.0 — 53 endpoint للقرآن الكريم · الأحاديث · مواقيت الصلاة · رحلة إسلامية يومية.</p>' +
    '<div class="card"><h3 style="margin:0 0 8px;color:#1A1816">📄 السبب:</h3><div>' + (reason||'خطأ غير معروف').replace(/[<>&]/g,'') + '</div></div>' +
    '<div class="card"><h3 style="margin:0 0 12px;color:#1A1816">🚀 الخيارات البديلة (كلها تعمل 100%):</h3><ul>' +
    '<li><b>الخيار 1</b> — افتحي التوثيق في الموقع الرسمي لـ Swagger Editor (الرابط اللي شايفيناه فوق بيعمل كل شيء): <a href="https://editor.swagger.io/?url=' + location.origin + '${safeSpecUrl}" target="_blank">editor.swagger.io ↗</a></li>' +
    '<li><b>الخيار 2</b> — فريق Flutter يستخدمون Postman: <code>File → Import → رابط</code> وألصقي: <code>' + location.origin + '${safeSpecUrl}</code></li>' +
    '<li><b>الخيار 3</b> — حملي الملف JSON على جهازك وفتحيه في أي أداة Swagger: <a href="${safeSpecUrl}">${safeSpecUrl}</a></li>' +
    '</ul></div>' +
    '<div class="aopt" style="display:flex;gap:12px;flex-wrap:wrap">' +
    '<a class="btn p" target="_blank" href="https://editor.swagger.io/?url=' + location.origin + '${safeSpecUrl}">افتحي في Swagger Editor ↗</a>' +
    '<a class="btn s" href="${safeSpecUrl}">تحميل ملف OpenAPI JSON ↓</a>' +
    '</div>' +
    '<div class="card" style="margin-top:18px"><b style="color:#1F8A59">💡 نصيحة:</b> Base URL اللي تستخدميه في تطبيق Flutter هو: <code>' + location.origin + '/api/v1</code>' +
    '<div class="quick-links" style="margin-top:14px">Endpoints سريعة للفريق: ' +
    '<code>/quran/surahs</code><code>/content/verse-of-day</code><code>/prayers/today</code><code>/journey/today</code><code>/health</code>' +
    '</div></div></div>';
}

// ---------- STEP 2: Load CSS with onerror fallback inline style ----------
(function loadCss(){
  var cssLoaded=false;
  try{
    var l = document.createElement('link');
    l.rel='stylesheet';
    l.href='https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css';
    l.onerror=function(){ cssLoaded=false; };
    l.onload =function(){ cssLoaded=true; };
    document.head.appendChild(l);
    setTimeout(function(){ if(!cssLoaded){ try{ var s=document.createElement('style'); s.textContent='.swagger-ui .topbar{display:none}.swagger-ui .info{padding:20px;background:#fff;border:1px solid #eee;border-radius:12px;margin:16px 0}.opblock{border:1px solid #EDE9E0;border-radius:12px;overflow:hidden;margin:12px 0;background:#fff}.opblock-summary{padding:14px}.opblock-summary-method{padding:6px 14px;border-radius:6px;font-weight:700;color:#fff;font-size:12px}'; document.head.appendChild(s) }catch(e){} } }, 3500);
  }catch(e){}
})();

// ---------- STEP 3: Load Swagger UI bundle with proper CDN versioned + timeout ----------
function loadScript(src, done, fail){
  try{
    var s = document.createElement('script');
    s.src = src;
    s.async = false;
    var doneCalled = false;
    s.onload = function(){ if(doneCalled) return; doneCalled = true; done && done(); };
    s.onerror = function(){ if(doneCalled) return; doneCalled = true; fail && fail(); };
    var t = setTimeout(function(){ if(doneCalled) return; doneCalled = true; fail && fail(); }, 7000);
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
        // Apply Noor Premium styling after render
        try{
          var tb = document.querySelector('.swagger-ui .topbar');
          if(tb){ tb.style.cssText='background:#FFFFFF;border-bottom:1px solid #EDE9E0;padding:14px 0;box-shadow:none;margin:0 -24px 32px;padding-inline:24px;position:sticky;top:0;z-index:5'; }
          var logoA = document.querySelector('.swagger-ui .topbar a'); if(logoA) logoA.style.display='none';
          var wr = document.querySelector('.swagger-ui .topbar .wrapper');
          if(wr){ var lg=document.createElement('div'); lg.style.cssText='font-size:26px;font-weight:800;color:#C9A46E;font-family:Tajawal,Inter,sans-serif;letter-spacing:-.8px'; lg.textContent='نور'; wr.insertBefore(lg,wr.firstChild); }
          document.querySelectorAll('.swagger-ui .info').forEach(function(e){ e.style.cssText='background:#FFFFFF;border:1px solid #EDE9E0;border-radius:12px;padding:28px 32px;margin:0 0 24px;box-shadow:0 1px 2px rgba(26,24,22,.04)'; });
          document.querySelectorAll('.opblock').forEach(function(e){ e.style.cssText='border:1px solid #EDE9E0;border-radius:12px;margin:12px 0;background:#fff;box-shadow:0 1px 2px rgba(26,24,22,.04);overflow:hidden'; });
          document.querySelectorAll('.opblock-summary-method').forEach(function(m){
            var t=(m.textContent||'').trim();
            if(t==='GET')m.style.background='#1F8A59';
            else if(t==='POST')m.style.background='#2D5FB0';
            else if(t==='PUT')m.style.background='#B38521';
            else if(t==='PATCH')m.style.background='#6C5AA8';
            else if(t==='DELETE')m.style.background='#BD3B2F';
            m.style.padding='6px 14px'; m.style.borderRadius='6px'; m.style.fontWeight='700'; m.style.color='#fff';
          });
          document.querySelectorAll('.btn.authorize').forEach(function(b){ b.style.background='#C9A46E';b.style.border='1px solid #B08F56';b.style.color='#FFFFFF';b.style.borderRadius='8px';b.style.padding='8px 18px';b.style.fontWeight='700'; });
          document.querySelectorAll('.btn.execute').forEach(function(b){ b.style.background='#1A1816';b.style.border='1px solid #1A1816';b.style.color='#FFFFFF';b.style.borderRadius='8px';b.style.padding='8px 18px';b.style.fontWeight='700'; });
          document.querySelectorAll('.scheme-container').forEach(function(e){e.style.cssText='background:#fff!important;border:1px solid #EDE9E0;border-radius:12px;padding:20px 28px;margin:0 0 24px!important;box-shadow:none!important';});
        }catch(_styleErr){}
      },
      onFailure: function(err){
        showFallback('خطأ أثناء عرض Swagger: '+ (err && err.message ? err.message : String(err)));
      }
    });
    // Extra safety: if Swagger bundle loads but renders empty after 6s, fallback
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
