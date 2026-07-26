# Vercel Deployment Guide

## Issues Fixed

This guide explains the fixes applied to make the Noor API work on Vercel.

### Problem 1: dist/ Not Included in Git

**Issue:** `.gitignore` was excluding the `dist/` folder, preventing the compiled code from being deployed.

**Solution:** Modified `.gitignore` to allow `dist/` to be tracked. The Vercel build process now:
1. Runs `npm run build` during deployment
2. Generates compiled files in `dist/`
3. Uses those files to serve requests

### Problem 2: .env Not Tracked

**Issue:** `.env` was in `.gitignore`, causing build failures when environment variables were needed.

**Solution:** `.env` is now tracked for development. **For production:**
- Remove `.env` from git after adding real secrets
- Set environment variables in Vercel Dashboard instead

### Problem 3: Vercel Serverless Handler

**Issue:** Vercel requires a serverless function handler, not a traditional Express server on a port.

**Solution:** The setup uses:
- `api/index.cjs` - Vercel serverless handler that imports and runs the Express app
- `vercel.json` - Configuration that routes all requests to the handler
- `dist/` - Compiled code that the handler imports

## Environment Variables Required

Set these in **Vercel Dashboard → Project Settings → Environment Variables:**

```
NODE_ENV=production
DATABASE_URL=postgresql://username:password@host:port/database
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-required-here
JWT_REFRESH_SECRET=your-super-secret-refresh-minimum-32-characters-required-here
CORS_ORIGIN=https://your-frontend-domain.com
```

**Important:** 
- `JWT_SECRET` and `JWT_REFRESH_SECRET` must be **at least 32 characters**
- Generate strong secrets: `openssl rand -base64 32`

## Database Setup

The API requires a PostgreSQL database. Options:

### Option 1: Vercel Postgres
```bash
# Create database
vercel postgres create

# Get connection string
vercel env pull
```

### Option 2: External PostgreSQL
Provide the connection string in `DATABASE_URL` environment variable.

### First Deployment
After setting environment variables:
```bash
# Optional: Run migrations
npm run prisma:migrate
```

## Deployment Steps

1. **Connect Repository**
   ```bash
   vercel link
   ```

2. **Set Environment Variables**
   - Vercel Dashboard → Project Settings → Environment Variables
   - Add all required variables

3. **Deploy**
   ```bash
   # Preview deployment
   vercel deploy --prebuilt

   # Production deployment
   vercel deploy --prod
   ```

4. **Verify**
   ```
   GET https://your-project.vercel.app/api/v1/health
   ```

## Troubleshooting

### Build Fails with "dist/ missing"
- Ensure `dist/` is not ignored in `.gitignore`
- Run `npm run build` locally to verify
- Push changes to git: `git add .` then `git commit`

### "Cannot find module" errors
- Check `node_modules/.prisma/client` is generated
- Run: `npm install` then `npm run prisma:generate`

### Database connection fails
- Verify `DATABASE_URL` is set in Vercel
- Check database is accessible from Vercel IPs
- For Vercel Postgres, use: `vercel postgres connect`

### JWT validation errors
- Ensure `JWT_SECRET` and `JWT_REFRESH_SECRET` are both at least 32 characters
- Use environment variables, not hardcoded values
- Regenerate with: `openssl rand -base64 32`

## Monitoring

View real-time logs:
```bash
vercel logs
```

Check deployments:
```bash
vercel list
```

View specific deployment:
```bash
vercel inspect <deployment-url>
```

## Rolling Back

To revert to a previous deployment:
```bash
# Promote previous deployment to production
vercel promote <deployment-url>
```

## Local Development vs Production

| Aspect | Local | Production |
|--------|-------|-----------|
| Server | Runs on port 3000 | Serverless function |
| Entry | `src/server.ts` | `api/index.cjs` |
| Database | Local PostgreSQL | Vercel Postgres or external |
| Environment | `.env` file | Vercel Dashboard |
| Build | TypeScript → `dist/` | TypeScript → `dist/` |

---

## Additional Resources

- [Vercel Docs](https://vercel.com/docs)
- [Vercel PostgreSQL](https://vercel.com/docs/storage/vercel-postgres)
- [Express on Vercel](https://vercel.com/docs/functions/serverless-functions/languages/node-js)
