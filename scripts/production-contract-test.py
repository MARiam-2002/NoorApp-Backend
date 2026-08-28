#!/usr/bin/env python3
"""
Production API Contract Compliance Test
Tests all endpoints against BACKEND_DATA_CONTRACT.md requirements
"""

import requests
import json
import sys
from datetime import datetime

BASE_URL = "https://noor-app-backend-one.vercel.app/api/v1"
COLORS = {
    'GREEN': '\033[92m',
    'RED': '\033[91m',
    'YELLOW': '\033[93m',
    'BLUE': '\033[94m',
    'BOLD': '\033[1m',
    'END': '\033[0m'
}

class ContractTester:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        self.access_token = None
        self.user_id = None
        
    def log(self, message, color=''):
        print(f"{color}{message}{COLORS['END']}")
    
    def test(self, name, condition, message=""):
        if condition:
            self.passed += 1
            self.log(f"  ✅ {name}", COLORS['GREEN'])
            if message:
                print(f"     {message}")
            return True
        else:
            self.failed += 1
            self.log(f"  ❌ {name}", COLORS['RED'])
            if message:
                print(f"     {message}")
            return False
    
    def warn(self, message):
        self.warnings += 1
        self.log(f"  ⚠️  {message}", COLORS['YELLOW'])
    
    def section(self, title):
        self.log(f"\n{'='*60}", COLORS['BLUE'])
        self.log(f"{title}", COLORS['BOLD'])
        self.log(f"{'='*60}", COLORS['BLUE'])
    
    def check_envelope(self, response, endpoint):
        """Check standard envelope format (§0)"""
        data = response.json() if response.headers.get('content-type', '').startswith('application/json') else None
        
        if not data:
            self.test(f"JSON response for {endpoint}", False, "Response is not JSON")
            return False
        
        # Success envelope
        if response.status_code < 400:
            checks = [
                ('success field exists', 'success' in data),
                ('success is true', data.get('success') == True),
                ('message field exists', 'message' in data and isinstance(data['message'], str)),
                ('data field exists', 'data' in data),
                ('timestamp field exists', 'timestamp' in data),
                ('requestId field exists', 'requestId' in data),
            ]
        else:
            # Error envelope
            checks = [
                ('success is false', data.get('success') == False),
                ('message field exists', 'message' in data),
                ('code field exists', 'code' in data),
            ]
        
        all_pass = all([self.test(name, cond) for name, cond in checks])
        return all_pass
    
    def test_auth(self):
        """Test Auth endpoints (§1)"""
        self.section("§1 AUTH ENDPOINTS")
        
        # Test sign-up
        self.log("\n🔐 POST /auth/sign-up")
        email = f"test_{datetime.now().timestamp()}@example.com"
        resp = requests.post(f"{BASE_URL}/auth/sign-up", json={
            "fullName": "Test User",
            "email": email,
            "password": "Test123!@#"
        })
        
        self.check_envelope(resp, "/auth/sign-up")
        
        if resp.status_code == 201:
            data = resp.json()['data']
            self.test("user object exists", 'user' in data)
            self.test("tokens object exists", 'tokens' in data)
            
            if 'user' in data:
                user = data['user']
                self.test("user.id exists", 'id' in user)
                self.test("user.fullName exists", 'fullName' in user and user['fullName'] == "Test User")
                self.test("user.email exists", 'email' in user)
                self.test("user.provider exists", 'provider' in user)
            
            if 'tokens' in data:
                tokens = data['tokens']
                self.test("accessToken exists", 'accessToken' in tokens and len(tokens['accessToken']) > 20)
                self.test("refreshToken exists", 'refreshToken' in tokens and len(tokens['refreshToken']) > 20)
                self.test("expiresIn exists", 'expiresIn' in tokens)
                
                self.access_token = tokens.get('accessToken')
                self.user_id = data.get('user', {}).get('id')
        
        # Test /auth/me
        if self.access_token:
            self.log("\n🔐 GET /auth/me")
            resp = requests.get(f"{BASE_URL}/auth/me", headers={
                "Authorization": f"Bearer {self.access_token}"
            })
            
            self.check_envelope(resp, "/auth/me")
            if resp.status_code == 200:
                data = resp.json()['data']
                self.test("Flat profile with id", 'id' in data)
                self.test("Flat profile with fullName", 'fullName' in data)
                self.test("Flat profile with email", 'email' in data)
                self.test("Flat profile with provider", 'provider' in data)
    
    def test_dashboard(self):
        """Test Dashboard (§2)"""
        if not self.access_token:
            self.warn("Skipping dashboard (no auth token)")
            return
        
        self.section("§2 HOME DASHBOARD")
        
        self.log("\n🏠 GET /dashboard")
        resp = requests.get(f"{BASE_URL}/dashboard", headers={
            "Authorization": f"Bearer {self.access_token}"
        })
        
        self.check_envelope(resp, "/dashboard")
        
        if resp.status_code == 200:
            data = resp.json()['data']
            
            # Check all required sections
            sections = ['greeting', 'prayers', 'verseOfTheDay', 'hadithOfTheDay', 
                       'dailyJourney', 'khatmah', 'dailyChallenge']
            
            for section in sections:
                self.test(f"{section} section exists", section in data, 
                         f"Found: {section in data}")
            
            # Check greeting structure
            if 'greeting' in data:
                g = data['greeting']
                self.test("greeting.displayName", 'displayName' in g)
                self.test("greeting.points", 'points' in g and isinstance(g['points'], (int, float)))
            
            # Check prayers structure
            if 'prayers' in data:
                p = data['prayers']
                self.test("prayers.nextPrayer exists", 'nextPrayer' in p)
                self.test("prayers.schedule exists", 'schedule' in p and isinstance(p['schedule'], list))
                
                if 'nextPrayer' in p:
                    np = p['nextPrayer']
                    self.test("nextPrayer.time is 24h format", 
                             'time' in np and ':' in np['time'] and len(np['time'].split(':')[0]) <= 2)
            
            # Check khatmah
            if 'khatmah' in data:
                k = data['khatmah']
                self.test("khatmah.surahNameAr exists", 'surahNameAr' in k)
                if 'surahNameAr' in k:
                    name = k['surahNameAr']
                    self.test("khatmah.surahNameAr is real Arabic (not numeric)", 
                             not name.isdigit() and name not in ['3', '6', '7'],
                             f"Got: {name}")
    
    def test_quran_public(self):
        """Test Quran public endpoints (§3)"""
        self.section("§3 QURAN - PUBLIC ENDPOINTS")
        
        # Test /quran/surahs
        self.log("\n📖 GET /quran/surahs")
        resp = requests.get(f"{BASE_URL}/quran/surahs")
        self.check_envelope(resp, "/quran/surahs")
        
        if resp.status_code == 200:
            data = resp.json()['data']
            self.test("Returns array", isinstance(data, list))
            self.test("Has 114 surahs", len(data) == 114)
            
            if len(data) > 0:
                surah = data[2]  # Al Imran (id=3)
                self.test("Surah has id", 'id' in surah)
                self.test("Surah has nameAr", 'nameAr' in surah)
                self.test("Surah has nameEn", 'nameEn' in surah)
                self.test("nameAr is real Arabic (not '3')", 
                         surah.get('nameAr', '').strip() not in ['3', '٣'] and not surah.get('nameAr', '').isdigit(),
                         f"Got: {surah.get('nameAr')}")
                self.test("Surah has revelationType", 'revelationType' in surah)
        
        # Test /quran/pages/:page
        self.log("\n📖 GET /quran/pages/50")
        resp = requests.get(f"{BASE_URL}/quran/pages/50")
        self.check_envelope(resp, "/quran/pages/50")
        
        if resp.status_code == 200:
            data = resp.json()['data']
            self.test("page field exists", 'page' in data and data['page'] == 50)
            self.test("ayahs array exists", 'ayahs' in data and isinstance(data['ayahs'], list))
            self.test("surahs array exists", 'surahs' in data and isinstance(data['surahs'], list))
            
            if 'surahs' in data and len(data['surahs']) > 0:
                surah = data['surahs'][0]
                self.test("Page surah has real nameAr", 
                         'nameAr' in surah and not surah['nameAr'].isdigit(),
                         f"Got: {surah.get('nameAr')}")
    
    def test_quran_auth(self):
        """Test Quran authenticated endpoints (§4)"""
        if not self.access_token:
            self.warn("Skipping authenticated Quran tests (no token)")
            return
        
        self.section("§4 QURAN - AUTHENTICATED PROGRESS")
        
        headers = {"Authorization": f"Bearer {self.access_token}"}
        
        # Test bookmarks
        self.log("\n📑 GET /quran/bookmarks")
        resp = requests.get(f"{BASE_URL}/quran/bookmarks", headers=headers)
        self.check_envelope(resp, "/quran/bookmarks")
        self.test("Returns 200 or 404", resp.status_code in [200, 404])
        
        # Create a bookmark
        self.log("\n📑 POST /quran/bookmarks")
        resp = requests.post(f"{BASE_URL}/quran/bookmarks", headers=headers, json={
            "surahId": 2,
            "ayahNumber": 255,
            "page": 42,
            "note": "آية الكرسي - test"
        })
        
        bookmark_id = None
        if resp.status_code in [200, 201]:
            self.check_envelope(resp, "POST /quran/bookmarks")
            data = resp.json()['data']
            self.test("Bookmark has id", 'id' in data)
            self.test("Bookmark has surahNameAr", 'surahNameAr' in data)
            self.test("surahNameAr is real (not '2')", 
                     data.get('surahNameAr', '') not in ['2', '٢'],
                     f"Got: {data.get('surahNameAr')}")
            bookmark_id = data.get('id')
        
        # Test last-read
        self.log("\n📍 PUT /quran/last-read")
        resp = requests.put(f"{BASE_URL}/quran/last-read", headers=headers, json={
            "surahId": 18,
            "page": 293,
            "ayahNumber": 1
        })
        self.check_envelope(resp, "PUT /quran/last-read")
        
        if resp.status_code == 200:
            data = resp.json()['data']
            self.test("Last-read has surahNameAr", 'surahNameAr' in data or ('surah' in data and 'nameAr' in data['surah']))
            self.test("Last-read has ayahNumber", 'ayahNumber' in data)
        
        # Test import-local
        self.log("\n📥 POST /quran/import-local")
        resp = requests.post(f"{BASE_URL}/quran/import-local", headers=headers, json={
            "bookmarks": [
                {"surahId": 36, "page": 442}
            ],
            "lastRead": {"surahId": 1, "page": 1, "ayahNumber": 1}
        })
        self.check_envelope(resp, "POST /quran/import-local")
        
        if resp.status_code == 200:
            data = resp.json()['data']
            self.test("Import returns imported counts", 'imported' in data)
        
        # Cleanup bookmark
        if bookmark_id:
            requests.delete(f"{BASE_URL}/quran/bookmarks/{bookmark_id}", headers=headers)
    
    def test_adhkar(self):
        """Test Adhkar endpoints (§6)"""
        self.section("§6 ADHKAR")
        
        # Test public adhkar home
        self.log("\n🤲 GET /adhkar")
        resp = requests.get(f"{BASE_URL}/adhkar")
        self.check_envelope(resp, "/adhkar")
        
        if resp.status_code == 200:
            data = resp.json()['data']
            self.test("Has greeting", 'greeting' in data)
            self.test("Has dailyWird", 'dailyWird' in data)
            self.test("Has categories", 'categories' in data and isinstance(data['categories'], list))
            
            if 'dailyWird' in data:
                w = data['dailyWird']
                self.test("dailyWird has progressPercent", 'progressPercent' in w)
                self.test("dailyWird has categoryKey", 'categoryKey' in w)
        
        # Test category detail
        self.log("\n🤲 GET /adhkar/categories/MORNING")
        resp = requests.get(f"{BASE_URL}/adhkar/categories/MORNING")
        self.check_envelope(resp, "/adhkar/categories/MORNING")
        
        if resp.status_code == 200:
            data = resp.json()['data']
            self.test("Category has key", 'key' in data and data['key'] == 'MORNING')
            self.test("Category has items", 'items' in data and isinstance(data['items'], list))
            
            if 'items' in data and len(data['items']) > 0:
                item = data['items'][0]
                self.test("Item has textAr", 'textAr' in item)
                self.test("Item has repeatCount", 'repeatCount' in item)
                self.test("Item has referenceAr", 'referenceAr' in item)
        
        # Test authenticated progress
        if self.access_token:
            self.log("\n🤲 GET /adhkar/progress")
            resp = requests.get(f"{BASE_URL}/adhkar/progress?categoryKey=MORNING", 
                              headers={"Authorization": f"Bearer {self.access_token}"})
            self.check_envelope(resp, "GET /adhkar/progress")
            
            if resp.status_code == 200:
                data = resp.json()['data']
                self.test("Progress has markedItemId", 'markedItemId' in data)
                self.test("Progress has items", 'items' in data and isinstance(data['items'], list))
                self.test("Progress has progressPercent", 'progressPercent' in data)
    
    def test_journey(self):
        """Test Journey endpoints (§7)"""
        if not self.access_token:
            self.warn("Skipping Journey tests (no token)")
            return
        
        self.section("§7 JOURNEY")
        
        headers = {"Authorization": f"Bearer {self.access_token}"}
        
        # Test /journey/today
        self.log("\n🚶 GET /journey/today")
        resp = requests.get(f"{BASE_URL}/journey/today", headers=headers)
        self.check_envelope(resp, "/journey/today")
        
        if resp.status_code == 200:
            data = resp.json()['data']
            self.test("Has date", 'date' in data)
            self.test("Has tasks array", 'tasks' in data and isinstance(data['tasks'], list))
            self.test("Has streakDays", 'streakDays' in data)
            self.test("Has points", 'points' in data)
            
            if 'tasks' in data and len(data['tasks']) > 0:
                task = data['tasks'][0]
                self.test("Task has key", 'key' in task)
                self.test("Task has titleAr", 'titleAr' in task)
                self.test("Task has done", 'done' in task)
        
        # Test /journey/progress
        self.log("\n🚶 GET /journey/progress")
        resp = requests.get(f"{BASE_URL}/journey/progress?days=7", headers=headers)
        self.check_envelope(resp, "/journey/progress")
        
        if resp.status_code == 200:
            data = resp.json()['data']
            self.test("Has periodDays or summary", 'periodDays' in data or 'summary' in data)
    
    def test_tasbih(self):
        """Test Tasbih endpoints (§8)"""
        if not self.access_token:
            self.warn("Skipping Tasbih tests (no token)")
            return
        
        self.section("§8 TASBIH")
        
        headers = {"Authorization": f"Bearer {self.access_token}"}
        
        self.log("\n📿 GET /tasbih/today")
        resp = requests.get(f"{BASE_URL}/tasbih/today", headers=headers)
        self.check_envelope(resp, "/tasbih/today")
        
        if resp.status_code == 200:
            data = resp.json()['data']
            self.test("Has count", 'count' in data or 'todayCount' in data)
            self.test("Has dhikr", 'dhikr' in data or 'currentDhikr' in data)
            self.test("Has dhikrAr", 'dhikrAr' in data or 'currentDhikrAr' in data)
    
    def test_qibla(self):
        """Test Qibla endpoint (§9)"""
        self.section("§9 QIBLA")
        
        self.log("\n🧭 GET /qibla/calculate")
        resp = requests.get(f"{BASE_URL}/qibla/calculate?lat=30.0&lng=31.0")
        self.check_envelope(resp, "/qibla/calculate")
        
        if resp.status_code == 200:
            data = resp.json()['data']
            self.test("Has bearingDegrees", 'bearingDegrees' in data)
            self.test("Has directionAr", 'directionAr' in data)
            self.test("Has distanceKm", 'distanceKm' in data)
    
    def run_all_tests(self):
        """Run all contract tests"""
        self.log(f"\n{'='*60}", COLORS['BOLD'])
        self.log("NOOR API PRODUCTION CONTRACT COMPLIANCE TEST", COLORS['BOLD'])
        self.log(f"Base URL: {BASE_URL}", COLORS['BOLD'])
        self.log(f"Contract: BACKEND_DATA_CONTRACT.md", COLORS['BOLD'])
        self.log(f"{'='*60}\n", COLORS['BOLD'])
        
        try:
            self.test_auth()
            self.test_dashboard()
            self.test_quran_public()
            self.test_quran_auth()
            self.test_adhkar()
            self.test_journey()
            self.test_tasbih()
            self.test_qibla()
        except Exception as e:
            self.log(f"\n❌ FATAL ERROR: {e}", COLORS['RED'])
            import traceback
            traceback.print_exc()
        
        # Print summary
        self.log(f"\n{'='*60}", COLORS['BOLD'])
        self.log("TEST SUMMARY", COLORS['BOLD'])
        self.log(f"{'='*60}", COLORS['BOLD'])
        self.log(f"✅ Passed: {self.passed}", COLORS['GREEN'])
        self.log(f"❌ Failed: {self.failed}", COLORS['RED'])
        self.log(f"⚠️  Warnings: {self.warnings}", COLORS['YELLOW'])
        
        total = self.passed + self.failed
        if total > 0:
            percentage = (self.passed / total) * 100
            self.log(f"\n📊 Success Rate: {percentage:.1f}% ({self.passed}/{total})", COLORS['BOLD'])
        
        if self.failed == 0:
            self.log(f"\n🎉 ALL TESTS PASSED! Backend is 100% contract-compliant!", COLORS['GREEN'] + COLORS['BOLD'])
            return 0
        else:
            self.log(f"\n⚠️  Some tests failed. Please review the output above.", COLORS['YELLOW'])
            return 1

if __name__ == '__main__':
    tester = ContractTester()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)
