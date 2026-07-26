# Noor API

Production-ready REST API foundation for **Noor** — your daily companion on your journey of faith.

Built with Express.js, TypeScript, PostgreSQL, and Prisma ORM using Feature-Based Architecture, Clean Architecture, and SOLID principles.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Environment](#environment)
- [Scripts](#scripts)
- [Architecture](#architecture)
- [Folder Structure](#folder-structure)
- [API Docs](#api-docs)
- [Coding Standards](#coding-standards)
- [Git Workflow](#git-workflow)
- [Docker](#docker)
- [Testing](#testing)

---

## Features

- REST API with versioning (`/api/v1`)
- Unified response wrapper (success & error)
- Request ID + correlation logging (`X-Request-ID`)
- Prisma error mapping (e.g. `P2002` → `Email already exists`)
- Pagination, sorting, filtering & cursor pagination helpers
- JWT-ready auth structure (not implemented yet)
- Security middleware (helmet, cors, rate limit, hpp, compression)
- Zod validation with shared schemas
- Winston + Morgan logging
- Swagger documentation
- Storage & cache provider interfaces (Local, S3, Cloudinary, Redis)
- Event bus for notifications, emails, analytics
- Scheduler placeholder for cron jobs
- Docker & GitHub Actions CI

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ |
| Framework | Express.js 5 |
| Language | TypeScript 5 |
| Database | PostgreSQL |
| ORM | Prisma 6 |
| Validation | Zod |
| Logging | Winston + Morgan |
| Docs | Swagger (OpenAPI 3) |
| Testing | Vitest + Supertest |

---

## Installation

### Prerequisites

- Node.js >= 20
- PostgreSQL >= 14
- npm

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd noor-api

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Generate Prisma client
npm run prisma:generate

# Run database migrations (when models are added)
npm run prisma:migrate

# Start development server
npm run dev
```

The API will be available at `http://localhost:3000/api/v1`.

---

## Environment

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | `development` \| `staging` \| `production` \| `test` | `development` |
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | — |
| `JWT_REFRESH_SECRET` | Refresh token secret | — |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | `http://localhost:3000` |
| `STORAGE_PROVIDER` | `local` \| `s3` \| `cloudinary` | `local` |
| `CACHE_PROVIDER` | `memory` \| `redis` | `memory` |
| `SWAGGER_ENABLED` | Enable Swagger UI | `true` |

See `.env.example` for the full list.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:studio` | Open Prisma Studio |

---

## Architecture

The project follows **Feature-Based Architecture** layered with **Clean Architecture**:

```
Request → Middleware → Route → Controller → Service → Repository → Database
                                    ↓
                                 Domain (entities, interfaces)
```

### Layers

| Layer | Path | Responsibility |
|-------|------|----------------|
| **Config** | `src/config/` | Environment & app configuration |
| **Core** | `src/core/` | Errors, middleware, logging, request context |
| **Infrastructure** | `src/infrastructure/` | Database, storage, cache, events, HTTP |
| **Modules** | `src/modules/` | Feature modules (Auth, Users, Quran, etc.) |
| **Routes** | `src/routes/` | API routing & versioning |
| **Shared** | `src/shared/` | Constants, enums, utils, validation schemas |

### API Response Format

**Success:**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {}
}
```

**Error:**
```json
{
  "success": false,
  "message": "Validation Error",
  "errors": [
    { "field": "email", "message": "Invalid email" }
  ]
}
```

---

## Folder Structure

```
noor-api/
├── .github/workflows/       # CI/CD pipelines
├── prisma/                  # Prisma schema & migrations
├── src/
│   ├── config/              # Central configuration
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   ├── security.config.ts
│   │   ├── swagger.config.ts
│   │   ├── mail.config.ts
│   │   ├── storage.config.ts
│   │   └── cache.config.ts
│   ├── core/
│   │   ├── context/         # Request context (AsyncLocalStorage)
│   │   ├── errors/          # AppError, error codes
│   │   ├── middleware/      # Global middleware
│   │   ├── types/           # Express type extensions
│   │   └── utils/           # Logger
│   ├── infrastructure/
│   │   ├── database/        # Prisma, base repository, error mapper
│   │   ├── storage/         # Storage providers (Local, S3, Cloudinary)
│   │   ├── cache/           # Cache providers (Memory, Redis)
│   │   ├── events/          # Event bus
│   │   ├── scheduler/       # Cron jobs
│   │   └── http/            # Security, Swagger, auth stubs
│   ├── modules/             # Feature modules (empty — add later)
│   ├── routes/
│   │   └── v1/              # Version 1 routes
│   ├── shared/
│   │   ├── constants/       # API prefix, roles, permissions, etc.
│   │   ├── enums/           # Environment, storage, cache enums
│   │   ├── types/           # Shared TypeScript types
│   │   ├── utils/           # Response, pagination, sorting, etc.
│   │   └── validation/      # Shared Zod schemas
│   ├── app.ts               # Express app factory
│   └── server.ts            # Server bootstrap
├── tests/
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   └── e2e/                 # End-to-end tests
├── Dockerfile
├── docker-compose.yml
└── vitest.config.ts
```

---

## API Docs

Swagger UI is available at:

```
GET /api/v1/docs
GET /api/v1/docs.json
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | Health check |
| `GET` | `/api/v1/docs` | Swagger UI |

---

## Coding Standards

- **TypeScript strict mode** — no `any`, prefer precise types
- **ESLint + Prettier** — enforced via CI
- **Path aliases** — use `@config`, `@core`, `@shared`, etc.
- **Zod validation** — use shared schemas from `shared/validation/`
- **Response wrapper** — always use `sendSuccess()` / `sendError()` helpers
- **Async handlers** — wrap with `asyncHandler()`
- **Errors** — throw `AppError` for operational errors
- **Logging** — use `logger` (auto-includes request ID)

---

## Git Workflow

```
main          ← production-ready code
develop       ← integration branch
feature/*     ← new features
fix/*         ← bug fixes
hotfix/*      ← urgent production fixes
```

### Commit Convention

```
feat: add user registration endpoint
fix: resolve pagination offset bug
chore: update dependencies
docs: update API documentation
test: add health endpoint integration test
refactor: extract pagination helper
```

### Pull Request Checklist

- [ ] Code passes `npm run lint`
- [ ] Code passes `npm run typecheck`
- [ ] Tests pass `npm run test`
- [ ] Build succeeds `npm run build`
- [ ] Environment variables documented in `.env.example`
- [ ] No secrets committed

---

## Deployment

### Vercel

The project is configured to run on Vercel as a serverless API.

**Build & Deploy:**

1. Connect your GitHub repository to Vercel
2. Set these environment variables in Vercel Dashboard → Project Settings → Environment Variables:
   - `DATABASE_URL` - PostgreSQL connection string
   - `JWT_SECRET` - At least 32 characters (use `openssl rand -base64 32`)
   - `JWT_REFRESH_SECRET` - At least 32 characters (use `openssl rand -base64 32`)
   - All other variables from `.env.example`

3. Deploy
   ```bash
   vercel deploy
   ```

**Automatic Deployment:**
- Push to `main` branch → auto-deploys to production
- Push to feature branches → auto-deploys to preview

**Vercel Configuration:**
- `vercel.json` - Configured with serverless function handler
- Build Command: `npm run build`
- Output: `dist/`
- Function: `api/index.cjs`

### Docker

```bash
# Start all services (API + PostgreSQL + Redis)
docker compose up -d

# Build only
docker compose build

# View logs
docker compose logs -f api
```

---

## Testing

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

Test structure:
- `tests/unit/` — pure function & utility tests
- `tests/integration/` — HTTP endpoint tests with Supertest
- `tests/e2e/` — full environment tests (via Docker)

---

## License

MIT
