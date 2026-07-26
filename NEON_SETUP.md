# Neon Database Setup for Vercel Deployment

## Overview

This project uses **Neon** (PostgreSQL) as the database and is deployed on **Vercel**. Prisma handles all database migrations and schema management.

## Prerequisites

- Neon account with a PostgreSQL database created
- Vercel project connected to your GitHub repository
- DATABASE_URL from Neon

## Step-by-Step Setup

### 1. Create Database on Neon

1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Create a PostgreSQL database
4. Copy the connection string (DATABASE_URL)

### 2. Add Environment Variables to Vercel

Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

Add these variables:

```
NODE_ENV=production
DATABASE_URL=postgresql://[user]:[password]@[host]/[dbname]
JWT_SECRET=<32+ character random string>
JWT_REFRESH_SECRET=<32+ character random string>
CORS_ORIGIN=https://your-frontend-domain.com (if applicable)
```

**Generate strong JWT secrets:**
```bash
openssl rand -base64 32
```

### 3. Automatic Migration on Deployment

The project is configured to automatically run Prisma migrations during the build process:

```json
// vercel.json
"buildCommand": "npm run build && npm run prisma:deploy"
```

This means:
- TypeScript compiles to JavaScript ✓
- Pending Prisma migrations run against Neon ✓
- Database schema updates automatically ✓

### 4. Deploy to Vercel

Push your code to the connected GitHub branch:

```bash
git push origin main
```

Vercel will:
1. Install dependencies
2. Compile TypeScript
3. Run Prisma migrations
4. Deploy the serverless function
5. Your API is live!

## Database Management

### View Database (Neon Console)

1. Go to [console.neon.tech](https://console.neon.tech)
2. Select your project and branch
3. View tables, run queries

### View Database (Prisma Studio)

Locally only:
```bash
npm run prisma:studio
```

This opens a web interface at http://localhost:5555

### Apply Migrations Locally

```bash
npm run prisma:migrate
```

### Push Schema Changes to Database

```bash
npm run prisma:push
```

### Generate Prisma Client

```bash
npm run prisma:generate
```

## Prisma Files Structure

```
prisma/
├── schema.prisma          # Database schema definition
├── migrations/            # All migration files
│   ├── 20260718100000_init_auth/
│   ├── 20260718200000_dashboard_features/
│   └── ...other migrations
└── seed.ts               # Initial data (optional)
```

## Common Tasks

### Add a New Table

1. Edit `prisma/schema.prisma`
2. Run: `npm run prisma:migrate`
3. Prisma creates a migration file automatically

### Modify Existing Table

1. Edit `prisma/schema.prisma`
2. Run: `npm run prisma:migrate`
3. Name your migration (e.g., "add_user_profile_fields")

### Reset Database (⚠️ Destructive)

```bash
npx prisma migrate reset
```

⚠️ This deletes all data and re-runs all migrations from scratch.

## Troubleshooting

### "Migration failed" Error on Vercel

**Check:**
1. DATABASE_URL is set correctly in Vercel
2. All required environment variables are present
3. Neon database is running and accessible

**View Logs:**
- Vercel Dashboard → Deployments → Click deployment → View logs

### "Could not find _prisma_migrations table"

**Solution:** The Prisma migrations table wasn't created
```bash
npm run prisma:deploy  # Creates the table and runs migrations
```

### Database Connection Timeout

**Check:**
1. Neon IP whitelist: https://console.neon.tech → Your project → Network
2. DATABASE_URL is correct
3. Neon project is active (not in sleep mode)

### Schema Mismatch

**Solution:**
```bash
npm run prisma:push     # Push schema to database
npm run prisma:migrate  # Create migration files
```

## Security Notes

- ✓ DATABASE_URL is private (environment variable only)
- ✓ Migrations are version controlled (safe)
- ✓ Schema changes are tracked in git
- ✗ Never commit sensitive data to .env files in production

## References

- [Neon Documentation](https://neon.tech/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
