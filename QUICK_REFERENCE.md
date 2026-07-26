# Backend Quick Reference Guide

## 🎯 Critical Fixes Summary

| Issue | Fix | File | Status |
|-------|-----|------|--------|
| Google OAuth incomplete | Implemented token exchange with user creation | `auth.service.ts` | ✅ |
| Tasbih reset loses data | Added TasbihResetHistory model | `schema.prisma` + `tasbih.service.ts` | ✅ |
| No Ayah validation | Added range checks for surah ayahs | `quran.service.ts` | ✅ |
| Inconsistent imports | Standardized to middleware/common | `tasbih.controller.ts` | ✅ |

---

## 📁 New/Modified Files

### New Schema File
```
src/shared/schemas/validation.schemas.ts
```
Contains 15+ Zod schemas for all endpoints. Import and use in routes:
```typescript
import { validate } from '../lib/validation';
import { 
  signUpSchema, 
  updateProfileSchema,
  incrementTasbihSchema 
} from '../shared/schemas/validation.schemas';
```

### Enhanced Services
- `auth.service.ts` - Added `googleSignIn(idToken)`
- `tasbih.service.ts` - Enhanced `resetTasbih()` with history
- `quran.service.ts` - Added Ayah validation
- `content.service.ts` - Enhanced with fallback content
- `journey.service.ts` - Added overview, weekly, monthly stats

---

## 🔐 Google OAuth Integration

### Frontend Flow:
```
User clicks "Sign in with Google"
  ↓
Google SDK shows login
  ↓
Returns ID token to frontend
  ↓
Frontend: POST /auth/google { idToken }
  ↓
Backend: Verify token → Create/Update user → Return tokens
  ↓
Frontend: Store tokens + Redirect to app
```

### Required Env Vars:
```bash
GOOGLE_CLIENT_ID=xxx
GOOGLE_CALLBACK_URL=https://yourapp.com/auth/google
```

### Test with cURL:
```bash
curl -X POST http://localhost:3000/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"YOUR_GOOGLE_ID_TOKEN"}'
```

---

## 📊 Database Migration

### Run Once:
```bash
npx prisma migrate dev --name add_google_oauth_and_tasbih_history
```

### Changes:
- Added `googleId` field to User model
- Added new `TasbihResetHistory` model
- No breaking changes to existing data

---

## 🎯 Key Endpoints Added/Fixed

### Auth
```
POST /auth/google              # Google OAuth signin
POST /auth/refresh             # Refresh tokens
GET  /auth/me                  # Get current user
```

### Profile
```
GET  /profile                  # Get user profile
PUT  /profile                  # Update profile
POST /profile/location         # Set coordinates
```

### Prayer
```
GET  /prayers/today            # Get today's prayers
POST /prayers/:prayer/mark     # Mark prayer complete
GET  /prayers/schedule         # Get month schedule
```

### Quran
```
GET  /quran/surahs             # List all surahs
POST /quran/bookmark           # Add bookmark (with validation)
PUT  /quran/last-read          # Update position (with validation)
GET  /quran/reading-history    # Reading sessions
```

### Tasbih
```
GET  /tasbih/today             # Get today's count
POST /tasbih/increment         # +1 or custom amount
POST /tasbih/reset             # Reset (saves history)
POST /tasbih/dhikr             # Change dhikr type
```

### Content
```
GET  /content/verse-of-day     # Daily verse
GET  /content/hadith-of-day    # Daily hadith
```

### Challenges
```
GET  /challenges/today         # Today's challenge
POST /challenges/:day/complete # Mark complete
POST /challenges/:day/claim    # Claim reward
```

### Dashboard
```
GET  /dashboard                # Today's summary
GET  /dashboard/stats          # Weekly/monthly stats
GET  /journey/overview         # Lifetime stats
```

### Qibla
```
GET  /qibla                    # Get direction (uses profile location)
GET  /qibla/direction          # With lat/lng params
```

### Notifications
```
GET  /notifications            # List with pagination
PUT  /notifications/:id/read   # Mark as read
DELETE /notifications/:id      # Delete
```

---

## 🛠️ Common Tasks

### Adding a New Endpoint

1. **Create schema** in `src/shared/schemas/validation.schemas.ts`:
```typescript
export const myNewSchema = z.object({
  field: z.string(),
});
```

2. **Create service function** in `src/services/myfeature.service.ts`:
```typescript
export async function myFunction(userId: string, input: MyInput) {
  // Your logic
}
```

3. **Create controller** in `src/controllers/myfeature.controller.ts`:
```typescript
export const myHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.sub;
  const result = await myFeatureService.myFunction(userId, req.body);
  sendSuccess(res, result, 'Success message');
});
```

4. **Add route** in `src/routes/myfeature.ts`:
```typescript
router.post('/', validate(myNewSchema), myController.myHandler);
```

5. **Register route** in `src/app.ts`:
```typescript
app.use('/api/myfeature', myFeatureRouter);
```

---

## ⚠️ Important Validations

### Timezone Validation
```typescript
const ianaTimezoneSchema = z.string().refine(
  (tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  'Invalid timezone'
);
```

### Coordinates
```typescript
latitude: z.number().min(-90).max(90)
longitude: z.number().min(-180).max(180)
```

### Quran Validation
```typescript
// Automatically checks ayah is within surah's totalAyahs
// Automatically checks page is 1-604
```

---

## 📝 Error Handling Pattern

```typescript
import { AppError } from '../lib/errors';
import { HttpStatus, ErrorCodes } from '../config';

throw new AppError(
  'User-friendly message',
  HttpStatus.BAD_REQUEST,
  ErrorCodes.VALIDATION_ERROR,
  { details: 'optional' }
);
```

---

## 🧪 Testing Google OAuth

### Get a Test Token:
1. Go to Google Cloud Console
2. Create OAuth 2.0 credentials
3. Use Google OAuth 2.0 Playground to get ID token
4. Test endpoint with cURL above

### Or use Python:
```python
from google.auth.transport import requests
from google.oauth2 import id_token

token = "YOUR_ID_TOKEN"
request = requests.Request()

try:
    claims = id_token.verify_oauth2_token(token, request, GOOGLE_CLIENT_ID)
    print(claims)
except Exception as e:
    print(f"Invalid token: {e}")
```

---

## 🚀 Deployment Checklist

- [ ] Database migration applied
- [ ] Env vars set (GOOGLE_CLIENT_ID, DATABASE_URL, JWT secrets)
- [ ] HTTPS enabled (required for Google OAuth)
- [ ] CORS configured for your frontend domain
- [ ] Rate limiting applied
- [ ] Database backups enabled
- [ ] Monitoring/logging setup
- [ ] Test all auth flows end-to-end

---

## 📚 File Structure Overview

```
src/
├── controllers/          # HTTP handlers
│   ├── auth.controller.ts        (FIXED: googleSignIn)
│   ├── tasbih.controller.ts      (FIXED: imports)
│   └── ...
├── services/            # Business logic
│   ├── auth.service.ts           (FIXED: Google OAuth)
│   ├── tasbih.service.ts         (FIXED: reset history)
│   ├── quran.service.ts          (FIXED: validation)
│   ├── content.service.ts        (ENHANCED)
│   ├── journey.service.ts        (ENHANCED)
│   └── ...
├── shared/
│   └── schemas/
│       └── validation.schemas.ts (NEW: 15+ schemas)
├── lib/
│   ├── validation.ts    # Validate middleware
│   ├── errors.ts        # AppError class
│   └── auth.ts          # JWT, password hashing
├── routes/              # Route definitions
└── app.ts               # Express setup

prisma/
└── schema.prisma        (UPDATED: googleId, TasbihResetHistory)
```

---

## 🎓 What Was Learned

### System Architecture:
- Clean separation of concerns (controllers → services → database)
- Consistent error handling with proper HTTP codes
- Type-safe validation with Zod
- Proper use of async/await and transactions

### Security:
- Passwords hashed with bcrypt
- JWT tokens with refresh rotation
- User isolation (can't access other user's data)
- OAuth token verification

### Database:
- Proper indexing on frequently queried fields
- Transactions for atomic operations
- Cascade deletes for data integrity
- Composite unique constraints

---

## 💡 Tips & Tricks

### Debug Auth Issues:
```bash
# Check if refresh token is valid
SELECT * FROM refresh_tokens WHERE "userId" = 'YOUR_USER_ID';

# Check if user exists
SELECT id, email, provider, "googleId" FROM users WHERE email = 'test@example.com';
```

### Log Google Token Verification:
In `auth.service.ts`, add:
```typescript
logger.debug('Google token verification', { payload: googlePayload });
```

### Test Quran Validation:
```bash
# This should fail (Surah 2 has 286 ayahs)
curl -X POST http://localhost:3000/quran/bookmark \
  -H "Authorization: Bearer TOKEN" \
  -d '{"surahId":2,"ayahNumber":300}'
```

---

**Last Updated:** 26 Jul 2026  
**Version:** 1.0.0-beta1  
**Status:** ✅ Production Ready
