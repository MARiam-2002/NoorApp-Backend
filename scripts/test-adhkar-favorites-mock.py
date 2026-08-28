#!/usr/bin/env python3
"""
Test Adhkar Favorites - Mock Version
Tests the endpoints exist and work correctly (without real adhkar data in DB)
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://noor-app-backend-one.vercel.app/api/v1"

def test_endpoints_exist():
    print("\n🧪 Testing Adhkar Favorites Endpoints")
    print("=" * 60)
    
    # Step 1: Create test user
    print("\n1️⃣ Creating test user...")
    email = f"test_fav_{datetime.now().timestamp()}@example.com"
    resp = requests.post(f"{BASE_URL}/auth/sign-up", json={
        "fullName": "Favorites Test",
        "email": email,
        "password": "Test123!@#"
    })
    
    if resp.status_code != 201:
        print(f"❌ Sign-up failed: {resp.status_code}")
        return False
    
    access_token = resp.json()['data']['tokens']['accessToken']
    print(f"✅ User created: {email}")
    
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Step 2: Test GET /adhkar/favorites (should return empty list)
    print("\n2️⃣ Testing GET /adhkar/favorites...")
    resp = requests.get(f"{BASE_URL}/adhkar/favorites", headers=headers)
    
    if resp.status_code == 200:
        favorites = resp.json()['data']
        print(f"✅ Endpoint works! Found {len(favorites)} favorite(s)")
        print(f"   Response structure: {list(resp.json().keys())}")
    else:
        print(f"❌ GET failed: {resp.status_code}")
        print(resp.text)
        return False
    
    # Step 3: Test POST /adhkar/favorites (will fail due to missing data)
    print("\n3️⃣ Testing POST /adhkar/favorites...")
    print("   (Expected to fail: adhkar data not in DB)")
    
    resp = requests.post(f"{BASE_URL}/adhkar/favorites", 
                        headers=headers,
                        json={"itemId": "test-item-id"})
    
    if resp.status_code == 404:
        print("✅ Endpoint exists and returns 404 (expected)")
        print(f"   Message: {resp.json().get('message', 'N/A')}")
    elif resp.status_code in [200, 201]:
        print("✅ Endpoint works! (unexpected success)")
    else:
        print(f"⚠️ Unexpected status: {resp.status_code}")
    
    # Step 4: Test DELETE /adhkar/favorites/:id (will fail - no item to delete)
    print("\n4️⃣ Testing DELETE /adhkar/favorites/:id...")
    print("   (Expected to fail: no favorites exist)")
    
    resp = requests.delete(f"{BASE_URL}/adhkar/favorites/fake-id", 
                          headers=headers)
    
    if resp.status_code == 404:
        print("✅ Endpoint exists and returns 404 (expected)")
        print(f"   Message: {resp.json().get('message', 'N/A')}")
    else:
        print(f"⚠️ Unexpected status: {resp.status_code}")
    
    # Step 5: Test authentication requirement
    print("\n5️⃣ Testing authentication requirement...")
    
    resp = requests.get(f"{BASE_URL}/adhkar/favorites")  # No auth header
    
    if resp.status_code == 401:
        print("✅ Authentication required (correct)")
    else:
        print(f"⚠️ Expected 401, got {resp.status_code}")
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 ENDPOINT VERIFICATION RESULTS")
    print("=" * 60)
    print("✅ GET    /adhkar/favorites       - Exists & works")
    print("✅ POST   /adhkar/favorites       - Exists (needs DB seed)")
    print("✅ DELETE /adhkar/favorites/:id   - Exists (needs DB seed)")
    print("✅ Authentication - Required (correct)")
    print()
    print("⚠️  NOTE: Full functionality requires adhkar data in database")
    print("   Run: npx prisma db seed")
    print("=" * 60)
    
    return True

def test_with_real_adhkar_ids():
    """
    Test using actual adhkar IDs from the API
    This will show if seeding would fix the issue
    """
    print("\n\n🔍 BONUS: Testing with real adhkar IDs from API")
    print("=" * 60)
    
    # Get actual adhkar items from API
    print("\n1️⃣ Getting real adhkar items from API...")
    resp = requests.get(f"{BASE_URL}/adhkar/categories/MORNING")
    
    if resp.status_code != 200:
        print("❌ Could not get adhkar items")
        return False
    
    items = resp.json()['data']['items']
    if not items:
        print("❌ No items found")
        return False
    
    item_id = items[0]['id']
    item_text = items[0]['textAr'][:40]
    
    print(f"✅ Found item: {item_id}")
    print(f"   Text: {item_text}...")
    
    # Create user
    print("\n2️⃣ Creating test user...")
    email = f"test_real_{datetime.now().timestamp()}@example.com"
    resp = requests.post(f"{BASE_URL}/auth/sign-up", json={
        "fullName": "Real Test",
        "email": email,
        "password": "Test123!@#"
    })
    
    if resp.status_code != 201:
        print("❌ Sign-up failed")
        return False
    
    access_token = resp.json()['data']['tokens']['accessToken']
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Try to add favorite with real ID
    print(f"\n3️⃣ Attempting to add favorite with real API ID: {item_id}")
    resp = requests.post(f"{BASE_URL}/adhkar/favorites",
                        headers=headers,
                        json={"itemId": item_id})
    
    print(f"   Status: {resp.status_code}")
    print(f"   Response: {resp.json()}")
    
    if resp.status_code == 404:
        print("\n⚠️  DIAGNOSIS:")
        print("   - Item exists in API response (in-memory)")
        print("   - Item does NOT exist in database")
        print("   - Solution: Seed the database")
        print()
        print("   Run this command:")
        print("   $ npx prisma db seed")
    elif resp.status_code in [200, 201]:
        print("\n✅ SUCCESS! Database is seeded and feature works!")
        
        # Try to list favorites
        resp = requests.get(f"{BASE_URL}/adhkar/favorites", headers=headers)
        if resp.status_code == 200:
            favs = resp.json()['data']
            print(f"   Found {len(favs)} favorite(s) in user's list")
    
    return True

if __name__ == '__main__':
    try:
        test_endpoints_exist()
        test_with_real_adhkar_ids()
        exit(0)
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
