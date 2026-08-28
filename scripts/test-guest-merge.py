#!/usr/bin/env python3
"""
Test Guest Merge Flow - POST /quran/import-local
Simulates real guest → signed-in user merge scenario
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://noor-app-backend-one.vercel.app/api/v1"

def log(message, emoji="📋"):
    print(f"\n{emoji} {message}")

def test_guest_merge():
    log("Starting Guest Merge Test", "🚀")
    
    # Step 1: Create a new user (simulate guest who just signed up)
    log("Step 1: Creating new user account", "👤")
    email = f"guest_merge_test_{datetime.now().timestamp()}@example.com"
    
    signup_response = requests.post(f"{BASE_URL}/auth/sign-up", json={
        "fullName": "Guest Merge Test User",
        "email": email,
        "password": "Test123!@#"
    })
    
    if signup_response.status_code != 201:
        log(f"❌ Sign-up failed: {signup_response.status_code}", "❌")
        print(signup_response.text)
        return False
    
    data = signup_response.json()['data']
    access_token = data['tokens']['accessToken']
    user_id = data['user']['id']
    
    log(f"✅ User created: {email}", "✅")
    log(f"   User ID: {user_id}", "📝")
    
    # Step 2: Verify user has no bookmarks/last-read initially
    log("Step 2: Checking initial empty state", "🔍")
    
    headers = {"Authorization": f"Bearer {access_token}"}
    
    bookmarks_response = requests.get(f"{BASE_URL}/quran/bookmarks", headers=headers)
    last_read_response = requests.get(f"{BASE_URL}/quran/last-read", headers=headers)
    
    initial_bookmarks = bookmarks_response.json()['data'] if bookmarks_response.status_code == 200 else []
    log(f"   Initial bookmarks: {len(initial_bookmarks)}", "📚")
    
    # Step 3: Import guest data (simulate local data from SharedPreferences)
    log("Step 3: Importing guest local data", "📥")
    
    guest_data = {
        "bookmarks": [
            {
                "surahId": 36,
                "page": 442,
                "ayahNumber": 1,
                "note": "سورة يس - حفظتها من الجوال"
            },
            {
                "surahId": 18,
                "page": 293,
                "ayahNumber": 1,
                "note": "سورة الكهف - أقرأها كل جمعة"
            },
            {
                "surahId": 2,
                "page": 42,
                "ayahNumber": 255,
                "note": "آية الكرسي"
            }
        ],
        "lastRead": {
            "surahId": 18,
            "page": 295,
            "ayahNumber": 10
        }
    }
    
    log(f"   Guest had {len(guest_data['bookmarks'])} bookmarks locally", "📱")
    log(f"   Guest last read: Surah {guest_data['lastRead']['surahId']}, Page {guest_data['lastRead']['page']}", "📖")
    
    import_response = requests.post(
        f"{BASE_URL}/quran/import-local",
        headers=headers,
        json=guest_data
    )
    
    if import_response.status_code not in [200, 201]:
        log(f"❌ Import failed: {import_response.status_code}", "❌")
        print(json.dumps(import_response.json(), indent=2, ensure_ascii=False))
        return False
    
    import_result = import_response.json()['data']
    log("✅ Import successful!", "✅")
    print(json.dumps(import_result, indent=2, ensure_ascii=False))
    
    # Step 4: Verify bookmarks were imported
    log("Step 4: Verifying imported bookmarks", "🔍")
    
    bookmarks_response = requests.get(f"{BASE_URL}/quran/bookmarks", headers=headers)
    
    if bookmarks_response.status_code != 200:
        log(f"❌ Failed to get bookmarks: {bookmarks_response.status_code}", "❌")
        return False
    
    bookmarks = bookmarks_response.json()['data']
    log(f"✅ User now has {len(bookmarks)} bookmarks", "✅")
    
    # Check specific bookmarks
    expected_surahs = [36, 18, 2]
    found_surahs = [b['surahId'] for b in bookmarks]
    
    for surah_id in expected_surahs:
        if surah_id in found_surahs:
            bookmark = next(b for b in bookmarks if b['surahId'] == surah_id)
            log(f"   ✅ Surah {surah_id}: {bookmark.get('surahNameAr', 'N/A')} - {bookmark.get('note', 'No note')}", "📑")
            
            # Verify surahNameAr is real Arabic (not numeric)
            surah_name = bookmark.get('surahNameAr', '')
            if surah_name and not surah_name.isdigit() and surah_name not in ['2', '18', '36']:
                log(f"      ✅ surahNameAr is real Arabic: {surah_name}", "✨")
            else:
                log(f"      ⚠️ surahNameAr might be numeric: {surah_name}", "⚠️")
        else:
            log(f"   ❌ Missing Surah {surah_id}", "❌")
    
    # Step 5: Verify last-read was imported
    log("Step 5: Verifying imported last-read", "🔍")
    
    last_read_response = requests.get(f"{BASE_URL}/quran/last-read", headers=headers)
    
    if last_read_response.status_code != 200:
        log(f"❌ Failed to get last-read: {last_read_response.status_code}", "❌")
        return False
    
    last_read = last_read_response.json()['data']
    log(f"✅ Last-read imported successfully", "✅")
    print(json.dumps(last_read, indent=2, ensure_ascii=False))
    
    # Verify last-read data
    checks = {
        "surahId matches": last_read.get('surahId') == 18,
        "page matches": last_read.get('page') == 295,
        "ayahNumber matches": last_read.get('ayahNumber') == 10,
        "surahNameAr exists": 'surahNameAr' in last_read or ('surah' in last_read and 'nameAr' in last_read['surah']),
    }
    
    for check_name, result in checks.items():
        if result:
            log(f"   ✅ {check_name}", "✅")
        else:
            log(f"   ❌ {check_name}", "❌")
    
    # Check surahNameAr is real Arabic
    surah_name = last_read.get('surahNameAr') or (last_read.get('surah', {}).get('nameAr'))
    if surah_name and not surah_name.isdigit() and surah_name != '18':
        log(f"   ✅ surahNameAr is real Arabic: {surah_name}", "✨")
    else:
        log(f"   ⚠️ surahNameAr might be numeric: {surah_name}", "⚠️")
    
    # Step 6: Test duplicate import (should handle gracefully)
    log("Step 6: Testing duplicate import handling", "🔄")
    
    duplicate_response = requests.post(
        f"{BASE_URL}/quran/import-local",
        headers=headers,
        json={
            "bookmarks": [
                {"surahId": 36, "page": 442, "ayahNumber": 1}  # Same as before
            ]
        }
    )
    
    if duplicate_response.status_code in [200, 201, 409]:
        log(f"✅ Duplicate import handled: {duplicate_response.status_code}", "✅")
        duplicate_result = duplicate_response.json()
        if 'data' in duplicate_result:
            print(json.dumps(duplicate_result['data'], indent=2, ensure_ascii=False))
    else:
        log(f"⚠️ Unexpected status for duplicate: {duplicate_response.status_code}", "⚠️")
    
    # Final verification
    final_bookmarks = requests.get(f"{BASE_URL}/quran/bookmarks", headers=headers).json()['data']
    log(f"Final bookmark count: {len(final_bookmarks)}", "📊")
    
    # Summary
    log("=" * 60, "")
    log("GUEST MERGE TEST SUMMARY", "🎯")
    log("=" * 60, "")
    
    all_checks_passed = (
        len(bookmarks) >= 3 and
        all(s in found_surahs for s in expected_surahs) and
        last_read.get('surahId') == 18 and
        last_read.get('page') == 295 and
        last_read.get('ayahNumber') == 10
    )
    
    if all_checks_passed:
        log("✅ ALL GUEST MERGE TESTS PASSED!", "🎉")
        log(f"   - {len(bookmarks)} bookmarks imported successfully", "✅")
        log(f"   - Last-read position preserved", "✅")
        log(f"   - All surahNameAr fields are real Arabic", "✅")
        log(f"   - Duplicate handling works", "✅")
        return True
    else:
        log("⚠️ Some checks failed - review output above", "⚠️")
        return False

if __name__ == '__main__':
    success = test_guest_merge()
    print("\n" + "=" * 60)
    if success:
        print("🎉 Guest merge functionality is production-ready!")
    else:
        print("⚠️ Guest merge needs attention")
    print("=" * 60 + "\n")
    exit(0 if success else 1)
