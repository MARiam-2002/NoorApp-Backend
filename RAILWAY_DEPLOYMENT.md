# Railway Deployment — Noor API (2026)

Prepare and deploy this Express + Prisma backend on **Railway**.  
Production database stays on **Neon PostgreSQL**. Redis is optional (Railway Redis / Key Value).

**Do not run duplicate cron schedulers** (pick Railway Cron **or** GitHub Actions, not both).

---

## 1. Exact Railway setup steps

1. Create a Railway project → **New Service** → deploy from this GitHub repo (or CLI).
2. Attach (optional) a **Redis** plugin / Key Value and copy its `REDIS_URL` into the API service variables.
3. Set all **Required** environment variables (see §2). Keep Neon `DATABASE_URL` (pooled).
4. Set **Build Command** and **Start Command** (see §3–4). `railway.json` already suggests them.
5. Deploy. Confirm health: `GET https://<your-railway-domain>/api/v1/health`
6. Configure **one** cron source for prayer reminders (see §7).
7. Point Flutter / CORS to the Railway public URL (`PUBLIC_APP_ORIGIN` + `CORS_ORIGIN`).

---

## 2. Required environment variables

### Required for boot

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Neon PostgreSQL pooled URL (`sslmode=require`) |
| `JWT_SECRET` | ≥ 32 chars |
| `JWT_REFRESH_SECRET` | ≥ 32 chars |
| `NODE_ENV` | `production` |

### Strongly recommended for production

| Variable | Notes |
|----------|--------|
| `PORT` | Injected by Railway automatically |
| `HOST` | Default `0.0.0.0` (already set in code) |
| `PUBLIC_APP_ORIGIN` | e.g. `https://noor-api.up.railway.app` (no trailing slash) |
| `CORS_ORIGIN` | Comma-separated frontend origins |
| `CRON_SECRET` | Shared secret for `/api/v1/cron/prayer-reminders` |
| `MAIL_*` / `EMAIL_PROVIDER` / `RESEND_API_KEY` | Password-reset email (Brevo SMTP recommended) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` (or split Firebase fields) | FCM Azan backup |
| `QF_CLIENT_ID` / `QF_CLIENT_SECRET` | Optional Quran Foundation OAuth |

### Redis (optional)

| Variable | Notes |
|----------|--------|
| `REDIS_URL` | From Railway Redis (`redis://` or `rediss://`) |
| `CACHE_PROVIDER` | Keep `memory` unless you wire Redis-backed cache |

### Other optional

`JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `RATE_LIMIT_*`, `LOG_LEVEL`, `SWAGGER_ENABLED`, `RESET_PASSWORD_DEEPLINK`, `GOOGLE_*`, `STORAGE_*`, `QF_ENV`

Full template: `.env.example` (no real secrets).

---

## 3. Build command

```bash
npm run build
```

This runs TypeScript compile + copies the Hadith bank into `dist`.  
`postinstall` already runs `prisma generate` during `npm install`.

---

## 4. Start command

```bash
npm start
```

Equivalent to:

```bash
node dist/server.js
```

The process listens on `process.env.PORT` and binds `HOST` (default `0.0.0.0`).

---

## 5. Prisma / Neon

- Schema uses `env("DATABASE_URL")` — no local DB required on Railway.
- Generator binary targets include `debian-openssl-3.0.x` for Railway/Nixpacks.
- Migrations: prefer running once manually when schema changes:

```bash
npx prisma migrate deploy
```

- The app may also apply pending migrations on production boot (existing behavior). Prefer explicit `migrate deploy` in CI/release when possible.
- **Do not** use a local SQLite/Postgres for Railway production.

---

## 6. Redis setup

1. Add Railway **Redis** (or Key Value with Redis URL).
2. Set `REDIS_URL` on the API service (Railway often auto-injects when linked).
3. Keep `CACHE_PROVIDER=memory` unless you implement Redis caching against this URL.
4. Invalid Redis URL is **non-fatal** — API continues; check logs for `[Redis]` warnings.

---

## 7. Cron Job setup (prayer reminders)

Existing HTTP cron (unchanged contract):

- `POST /api/v1/cron/prayer-reminders`
- `GET  /api/v1/cron/prayer-reminders`
- Auth: `Authorization: Bearer <CRON_SECRET>` or header `X-Cron-Secret: <CRON_SECRET>` (or `?secret=`).
- **`x-vercel-cron` is NOT accepted.** Empty `CRON_SECRET` → always `401`.

### Recommended schedule (sole production scheduler)

```text
*/10 * * * *
```

(every 10 minutes — Azan backup window + Salawat reminders)

### Railway Cron Job command

Replace the public domain and ensure `CRON_SECRET` is available to the cron runner:

```bash
curl -fsS -X POST "https://YOUR-RAILWAY-DOMAIN.up.railway.app/api/v1/cron/prayer-reminders" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json"
```

### Single scheduler policy

| Source | Status |
|--------|--------|
| **Railway Cron** | **Use this** (production) |
| GitHub Actions `.github/workflows/prayer-reminder-cron.yml` | **Disabled** (no schedule; emergency dispatch only with `confirm=ENABLE`) |

There is **no** in-process `node-cron` loop — only the HTTP endpoint. Restarts do not spawn a second internal scheduler.

---

## 8. Health check

```http
GET /api/v1/health
```

- `200` + `data.status=ok` when DB is connected  
- `503` + `data.status=degraded` when DB is down  
- Does not expose secrets  

Railway `railway.json` sets `healthcheckPath` to `/api/v1/health`.

---

## 9. Important Railway settings

| Setting | Value |
|---------|--------|
| Build | `npm run build` |
| Start | `npm start` |
| Healthcheck path | `/api/v1/health` |
| Node | `engines.node` = `24.x` (use a compatible Railway Node image) |
| Root directory | repo root |
| Watch paths | default |

Ensure **`assets/`** is present in the deploy (Azan media files). Nixpacks deploys the full repo by default.

---

## 10. Production notes

- API routes and Flutter contracts are unchanged (`/api/v1/...`).
- Graceful shutdown handles `SIGTERM` / `SIGINT` and disconnects Prisma.
- CORS supports comma-separated origins via `CORS_ORIGIN`.
- `PUBLIC_APP_ORIGIN` should be set to the Railway public HTTPS URL after first deploy.
- Vercel `api/index.js` remains for legacy Vercel hosting; Railway uses `dist/server.js` only.

---

## 11. Quick verification checklist (local, before you deploy)

```bash
npm install
npx prisma generate
npm run build
npm start
# then: curl http://127.0.0.1:$PORT/api/v1/health
```
