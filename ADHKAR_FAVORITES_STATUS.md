# Adhkar Favorites Feature - Status Report

**Date:** August 28, 2026  
**Feature:** Save & manage favorite adhkar  
**Status:** ✅ Code Complete, ⚠️ Needs Database Seeding

---

## Implementation Status

### ✅ Completed

1. **Database Schema** ✅
   - `adhkar_favorites` table created
   - Foreign keys to `users` and `dhikr_items`
   - Unique constraint on `userId + itemId`
   - Indexes for performance

2. **API Endpoints** ✅
   ```
   GET    /adhkar/favorites       - List user's favorites
   POST   /adhkar/favorites       - Add to favorites
   DELETE /adhkar/favorites/:id   - Remove from favorites
   ```

3. **Service Layer** ✅
   - `listAdhkarFavorites()` - Get all favorites with full dhikr details
   - `addAdhkarFavorite()` - Add with duplicate check
   - `removeAdhkarFavorite()` - Remove with ownership check
   - `isAdhkarFavorited()` - Check if item is favorited

4. **Controller & Routes** ✅
   - Handlers implemented
   - OpenAPI documentation added
   - Authentication required

5. **Code Quality** ✅
   - TypeScript build: 0 errors
   - Deployed to production ✅

---

## ⚠️ Current Limitation

### Adhkar Data Not in Database

**Problem:**  
The adhkar items (from Hisnul Muslim) are currently generated **in-memory** by the service layer, not persisted in the database. This means:

- `/adhkar/categories/MORNING` returns items ✅
- But these items don't exist in `dhikr_items` table ❌
- So favorites can't be saved (404: Dhikr item not found) ❌

**Why:**  
The adhkar service uses hardcoded data that gets returned via API but isn't seeded into the production database.

**Solution:**  
Run the seed script to populate `dhikr_categories` and `dhikr_items` tables.

---

## How to Fix (For Backend Team)

### Option 1: Run Seed Script on Production

```bash
# Connect to production database
DATABASE_URL="postgresql://..." npx prisma db seed
```

### Option 2: Migrate Adhkar Data to Database

The adhkar data needs to be moved from in-memory to database:

1. Check `prisma/seed.ts` - does it seed adhkar?
2. If yes, run: `npx prisma db seed`
3. If no, create migration to insert adhkar data

### Option 3: Quick Test (Local)

For testing locally:

```bash
# 1. Point to local database
cp .env.example .env.local
# Edit DATABASE_URL to local postgres

# 2. Run migrations
npx prisma migrate dev

# 3. Seed data
npx prisma db seed

# 4. Test locally
# Change BASE_URL in test script to http://localhost:3000/api/v1
python scripts/test-adhkar-favorites.py
```

---

## Expected Behavior (After Seeding)

### 1. Add to Favorites

```bash
POST /adhkar/favorites
Authorization: Bearer {token}
Body: { "itemId": "fb-m-1" }

Response: 201 Created
{
  "success": true,
  "data": {
    "id": "fav-uuid",
    "itemId": "fb-m-1",
    "dhikr": {
      "id": "fb-m-1",
      "textAr": "أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ...",
      "repeatCount": 1,
      "referenceAr": "آية الكرسي",
      "category": {
        "key": "MORNING",
        "nameAr": "اذكار الصباح"
      }
    },
    "createdAt": "2026-08-28T..."
  }
}
```

### 2. List Favorites

```bash
GET /adhkar/favorites
Authorization: Bearer {token}

Response: 200 OK
{
  "success": true,
  "data": [
    {
      "id": "fav-uuid",
      "itemId": "fb-m-1",
      "dhikr": { /* full dhikr details */ },
      "createdAt": "2026-08-28T..."
    }
  ]
}
```

### 3. Remove from Favorites

```bash
DELETE /adhkar/favorites/{favoriteId}
Authorization: Bearer {token}

Response: 200 OK
{
  "success": true,
  "data": {
    "message": "Favorite removed successfully"
  }
}
```

---

## For Flutter Team

### Current Status

✅ **API endpoints are ready and deployed**  
✅ **Authentication works**  
✅ **Database schema is in place**  
⚠️ **BUT: Adhkar data needs to be seeded first**

### What to Expect

Until adhkar data is seeded in production:
- `/adhkar/categories/MORNING` will work (returns in-memory data) ✅
- `POST /adhkar/favorites` will return `404: Dhikr item not found` ❌

After seeding:
- All endpoints will work correctly ✅

### Recommended Approach

1. **For now:** Build UI with mock/local favorites
2. **Backend team:** Seed production database
3. **Then:** Connect to real API endpoints

### UI Implementation Guide

```dart
class AdhkarFavoritesService {
  // 1. Check if item is favorited
  Future<bool> isFavorited(String itemId) async {
    final favorites = await getFavorites();
    return favorites.any((f) => f.itemId == itemId);
  }
  
  // 2. Toggle favorite
  Future<void> toggleFavorite(String itemId) async {
    if (await isFavorited(itemId)) {
      // Remove
      final fav = favorites.firstWhere((f) => f.itemId == itemId);
      await removeFavorite(fav.id);
    } else {
      // Add
      await addFavorite(itemId);
    }
  }
  
  // 3. Show favorites screen
  Future<List<AdhkarFavorite>> getFavorites() async {
    final response = await api.get('/adhkar/favorites');
    return response.data.map((item) => AdhkarFavorite.fromJson(item)).toList();
  }
}
```

---

## Testing

### Manual Test (Once Seeded)

```bash
# 1. Get adhkar items
curl https://noor-app-backend-one.vercel.app/api/v1/adhkar/categories/MORNING

# 2. Sign up / Login
curl -X POST https://noor-app-backend-one.vercel.app/api/v1/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test","email":"test@example.com","password":"Test123"}'

# 3. Add favorite (use token from step 2, itemId from step 1)
curl -X POST https://noor-app-backend-one.vercel.app/api/v1/adhkar/favorites \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"itemId":"fb-m-1"}'

# 4. List favorites
curl https://noor-app-backend-one.vercel.app/api/v1/adhkar/favorites \
  -H "Authorization: Bearer {token}"
```

### Automated Test

```bash
# Will work after database is seeded
python scripts/test-adhkar-favorites.py
```

---

## Summary

| Component | Status |
|-----------|--------|
| Database Schema | ✅ Ready |
| API Endpoints | ✅ Deployed |
| Authentication | ✅ Working |
| Documentation | ✅ Complete |
| Code Quality | ✅ 0 errors |
| **Data Seeding** | ⚠️ **Required** |

**Next Step:** Seed adhkar data to production database, then feature is 100% ready.

---

**Generated:** August 28, 2026  
**Feature Branch:** main (deployed)  
**Deployment:** Vercel (auto-deployed)
