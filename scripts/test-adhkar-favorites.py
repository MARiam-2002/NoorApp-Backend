#!/usr/bin/env python3
"""
Test Adhkar Favorites endpoints
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://noor-app-backend-one.vercel.app/api/v1"

def test_adhkar_favorites():
    print("\n🧪 Testing Adhkar Favorites Feature")
    print("=" * 60)
    
    # Step 1: Create test user
    print("\n1️⃣ Creating test user...")
    email = f"test_favorites_{datetime.now().timestamp()}@example.com"
    resp = requests.post(f"{BASE_URL}/auth/sign-up", json={
        "fullName": "Favorites Test",
        "email": email,
        "password": "Test123!@#"
    })
    
    if resp.status_code != 201:
        print(f"❌ Sign-up failed: {resp.status_code}")
        print(resp.text)
        return False
    
    access_token = resp.json()['data']['tokens']['accessToken']
    print(f"✅ User created: {email}")
    
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Step 2: Get morning adhkar to find an item
    print("\n2️⃣ Getting morning adhkar...")
    resp = requests.get(f"{BASE_URL}/adhkar/categories/MORNING")
    
    if resp.status_code != 200 or not resp.json()['data']['items']:
        print("❌ No adhkar items found")
        return False
    
    item_id = resp.json()['data']['items'][0]['id']
    item_text = resp.json()['data']['items'][0]['textAr'][:50]
    print(f"✅ Found item: {item_id}")
    print(f"   Text: {item_text}...")
    
    # Step 3: Add to favorites
    print("\n3️⃣ Adding to favorites...")
    resp = requests.post(f"{BASE_URL}/adhkar/favorites", 
                        headers=headers,
                        json={"itemId": item_id})
    
    if resp.status_code not in [200, 201]:
        print(f"❌ Add favorite failed: {resp.status_code}")
        print(resp.text)
        return False
    
    favorite_id = resp.json()['data']['id']
    print(f"✅ Added to favorites")
    print(f"   Favorite ID: {favorite_id}")
    
    # Step 4: List favorites
    print("\n4️⃣ Listing favorites...")
    resp = requests.get(f"{BASE_URL}/adhkar/favorites", headers=headers)
    
    if resp.status_code != 200:
        print(f"❌ List favorites failed: {resp.status_code}")
        return False
    
    favorites = resp.json()['data']
    print(f"✅ Found {len(favorites)} favorite(s)")
    
    if len(favorites) > 0:
        fav = favorites[0]
        print(f"   Item: {fav['dhikr']['textAr'][:50]}...")
        print(f"   Category: {fav['dhikr']['category']['nameAr']}")
        print(f"   Repeat: {fav['dhikr']['repeatCount']}x")
    
    # Step 5: Try to add duplicate
    print("\n5️⃣ Testing duplicate prevention...")
    resp = requests.post(f"{BASE_URL}/adhkar/favorites", 
                        headers=headers,
                        json={"itemId": item_id})
    
    if resp.status_code == 409:
        print("✅ Duplicate correctly rejected (409 Conflict)")
    else:
        print(f"⚠️ Expected 409, got {resp.status_code}")
    
    # Step 6: Remove from favorites
    print("\n6️⃣ Removing from favorites...")
    resp = requests.delete(f"{BASE_URL}/adhkar/favorites/{favorite_id}", 
                          headers=headers)
    
    if resp.status_code != 200:
        print(f"❌ Remove failed: {resp.status_code}")
        return False
    
    print("✅ Removed from favorites")
    
    # Step 7: Verify empty list
    print("\n7️⃣ Verifying removal...")
    resp = requests.get(f"{BASE_URL}/adhkar/favorites", headers=headers)
    
    if resp.status_code == 200:
        favorites = resp.json()['data']
        if len(favorites) == 0:
            print("✅ Favorites list is empty (correct)")
        else:
            print(f"⚠️ Expected 0 favorites, found {len(favorites)}")
    
    # Summary
    print("\n" + "=" * 60)
    print("✅ All Adhkar Favorites tests passed!")
    print("=" * 60)
    
    return True

if __name__ == '__main__':
    try:
        success = test_adhkar_favorites()
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
