# Noor App Backend - Deployment Checklist ✅

## Build Status
- ✅ TypeScript compilation: PASSING
- ✅ Type checking: PASSING  
- ✅ Build command: SUCCESS
- ✅ All dependencies installed
- ✅ No compilation errors

## Pre-Deployment Requirements

### Environment Variables (Vercel Project Settings)
Set these in your Vercel project environment variables:

```
# Required - Database
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]

# Required - Security
JWT_SECRET=[min 32 chars, use: openssl rand -base64 32]
JWT_REFRESH_SECRET=[min 32 chars, use: openssl rand -base64 32]
BCRYPT_SALT_ROUNDS=12

# Optional - Google OAuth
GOOGLE_CLIENT_ID=[from Google Cloud Console]
GOOGLE_CLIENT_SECRET=[from Google Cloud Console]
GOOGLE_CALLBACK_URL=https://[your-domain]/api/v1/auth/google/callback

# Password reset — Brevo Free SMTP (Vercel Production)
EMAIL_PROVIDER=smtp
MAIL_ENABLED=true
MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=[Brevo SMTP login, xxx@smtp-brevo.com]
MAIL_PASSWORD=[Brevo SMTP key]
MAIL_FROM=[verified Brevo sender, never the SMTP login]
RESET_PASSWORD_DEEPLINK=noorapp://auth/reset-password?token={{token}}

# Optional - other services
STORAGE_PROVIDER=s3
CACHE_PROVIDER=redis
REDIS_URL=redis://[host]:[port]
```

### Database Setup
Before deploying, ensure database is initialized:

```bash
# Run migrations
npx prisma migrate deploy

# Optional - Seed sample data
npx prisma db seed
```

## Deployment to Vercel

### Option 1: GitHub (Recommended)
1. Push your branch to GitHub
2. Create PR and merge to main
3. Vercel auto-deploys on push to main
4. Monitor: https://vercel.com/dashboard

### Option 2: Vercel CLI
```bash
npm install -g vercel
vercel --prod
```

## Post-Deployment Verification

### 1. API Health Check
```bash
curl https://[your-domain]/api/v1/health
# Expected: 200 OK with API info
```

### 2. Database Connection
```bash
# Logs should show:
# ✓ Database connected
# ✓ Prisma client generated
```

### 3. Swagger Documentation
Visit: `https://[your-domain]/api-docs`

### 4. Endpoints Verification
```bash
# Test auth endpoint
curl -X POST https://[your-domain]/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!"}'

# Test prayer times
curl https://[your-domain]/api/v1/prayers?latitude=30&longitude=31

# Test content
curl https://[your-domain]/api/v1/content/verse-of-day
```

## Known Limitations (Post-Deployment Fix Required)

### Tasbih Reset History
The `tasbihResetHistory` feature requires post-deployment migration:

1. SSH into production server or use Vercel Functions
2. Run: `npx prisma migrate deploy`
3. Update `/src/services/tasbih.service.ts`:
   - Uncomment lines 85-95 (reset history save logic)

Alternative: Skip this feature for MVP

## Monitoring & Maintenance

### Logs
- View real-time logs: `vercel logs [project-name]`
- Error tracking: Monitor Winston logs in database
- Performance: Check Web Vitals in Vercel dashboard

### Performance Tips
1. Enable Redis caching (set `CACHE_PROVIDER=redis`)
2. Use CDN for static assets (Vercel auto-handles)
3. Monitor database query performance
4. Set up database indexes (see schema.prisma comments)

### Common Issues

**Issue: Database connection timeout**
- Check DATABASE_URL is correct
- Ensure IP whitelist includes Vercel IPs
- Verify network policies allow outbound connections

**Issue: JWT token invalid**
- Ensure JWT_SECRET is set and consistent
- Don't change JWT_SECRET after deployment (breaks existing tokens)

**Issue: Google OAuth failing**
- Verify GOOGLE_CALLBACK_URL matches Vercel domain
- Check OAuth credentials in Google Cloud Console
- Ensure redirect URLs are whitelisted

## Rollback Procedure

If deployment fails:

```bash
# Rollback to previous deployment
vercel rollback

# Or use GitHub to revert and push
git revert [commit-hash]
git push origin main
```

## Support Files

- `IMPLEMENTATION_COMPLETE.md` - Full technical documentation
- `QUICK_REFERENCE.md` - API endpoints and schemas
- `.env.example` - Environment template

## Next Steps

1. Deploy to Vercel (production)
2. Test all endpoints in production
3. Set up monitoring alerts
4. Run load testing if needed
5. Monitor logs for 24 hours

## Final Checklist

- [ ] All environment variables set in Vercel
- [ ] Database migrations completed
- [ ] Health check endpoint responds
- [ ] All critical endpoints tested
- [ ] Error monitoring configured
- [ ] SSL certificate valid
- [ ] CORS properly configured
- [ ] Rate limiting working
- [ ] Logs being collected

---

**Status**: ✅ Ready for production deployment

**Last Updated**: July 26, 2026

**Deployed By**: Your Team
