$base = "https://noor-app-backend-one.vercel.app/api/v1"
$global:fail = 0
function Test-Check($label, $cond) { if ($cond) { Write-Host "  ✅ $label" -ForegroundColor Green } else { Write-Host "  ❌ FAIL: $label" -ForegroundColor Red; $global:fail++ } }

Write-Host "`n[10] POST /auth/sign-up (temp user)" -ForegroundColor Yellow
$email = "test-contract-" + [Guid]::NewGuid().ToString("N").Substring(0,8) + "@noor.app"
$body = @{ fullName="Mariam Contract"; email=$email; password="Test@1234" } | ConvertTo-Json
$r = Invoke-RestMethod -Uri "$base/auth/sign-up" -Method Post -Body $body -ContentType "application/json"
Test-Check "success=true" ($r.success -eq $true)
Test-Check "user object present" ($null -ne $r.data.user)
Test-Check "tokens object present" ($null -ne $r.data.tokens)
Test-Check "accessToken length > 30" ($r.data.tokens.accessToken.Length -gt 30)
Test-Check "refreshToken length > 30" ($r.data.tokens.refreshToken.Length -gt 30)
Test-Check "expiresIn is NUMBER" ($r.data.tokens.expiresIn -is [int])
Test-Check "user.displayName alias present" ($r.data.user.PSObject.Properties.Name -contains 'displayName')
$accessToken = $r.data.tokens.accessToken
$refreshToken = $r.data.tokens.refreshToken
$h = @{ Authorization = "Bearer $accessToken" }

Write-Host "`n[11] GET /auth/me" -ForegroundColor Yellow
$r = Invoke-RestMethod -Uri "$base/auth/me" -Method Get -Headers $h
Test-Check "id matches" ($r.data.email -eq $email)
Test-Check "fullName present" (-not [string]::IsNullOrEmpty($r.data.fullName))
Test-Check "aliases: displayName" ($r.data.PSObject.Properties.Name -contains 'displayName')
Test-Check "aliases: username" ($r.data.PSObject.Properties.Name -contains 'username')
Test-Check "quranAutoScrollEnabled field present" ($r.data.PSObject.Properties.Name -contains 'quranAutoScrollEnabled')

Write-Host "`n[12] GET /dashboard (7 sections)" -ForegroundColor Yellow
$r = Invoke-RestMethod -Uri "$base/dashboard" -Method Get -Headers $h
Test-Check "greeting present" ($null -ne $r.data.greeting)
Test-Check "prayers present" ($null -ne $r.data.prayers)
Test-Check "dailyJourney present" ($null -ne $r.data.dailyJourney)
Test-Check "khatmah present" ($null -ne $r.data.khatmah)
Test-Check "dailyChallenge present" ($null -ne $r.data.dailyChallenge)
Test-Check "utilities present" ($null -ne $r.data.utilities)
$dc = $r.data.dailyChallenge
Test-Check "dailyChallenge.titleAr present" (-not [string]::IsNullOrEmpty($dc.titleAr))
Test-Check "dailyChallenge.descriptionAr present" (-not [string]::IsNullOrEmpty($dc.descriptionAr))
Test-Check "dailyChallenge.rewardPoints present" ($null -ne $dc.rewardPoints)
Test-Check "dailyChallenge.targetValue present" ($null -ne $dc.targetValue)
Test-Check "dailyChallenge.completed present" ($null -ne $dc.completed)
Test-Check "dailyChallenge.claimed present" ($null -ne $dc.claimed)
$np = $r.data.prayers.nextPrayer
Test-Check "prayers schedule 5 entries" ($r.data.prayers.schedule.Count -eq 5)
Test-Check "24h time format HH:mm" ($np.time -match '^\d{2}:\d{2}$')
Test-Check "nextPrayer iso present" ($null -ne $np.iso)
Test-Check "nextPrayer displayAr present" ($null -ne $np.displayAr)
Test-Check "nextPrayer displayEn present" ($null -ne $np.displayEn)
Test-Check "khatmah surahNameAr not numeric" ($r.data.khatmah.surahNameAr -notmatch '^\d+$')
$pr = $r.data.dailyJourney.prayer
Test-Check "dailyJourney.prayer.progress is fraction (0-1 decimal)" ($pr.progress -match '^0(\.\d+)?$|^1$|^0\.\d+$')

Write-Host "`n[13] GET /journey/today" -ForegroundColor Yellow
$r = Invoke-RestMethod -Uri "$base/journey/today" -Method Get -Headers $h
Test-Check "date present" (-not [string]::IsNullOrEmpty($r.data.date))
Test-Check "tasks array count > 0" ($r.data.tasks.Count -gt 0)
Test-Check "streakDays number" ($null -ne $r.data.streakDays)
Test-Check "badges array" ($r.data.badges -is [array])
Test-Check "points number" ($null -ne $r.data.points)
Test-Check "dailyChallenge present" ($null -ne $r.data.dailyChallenge)
Test-Check "tasks[0] captionAr present" ($r.data.tasks[0].PSObject.Properties.Name -contains 'captionAr')
Test-Check "tasks[0] labelAr present" ($r.data.tasks[0].PSObject.Properties.Name -contains 'labelAr')
Test-Check "quran nested has pages/goal/percent" ($r.data.quran.PSObject.Properties.Name -contains 'pages' -and $r.data.quran.PSObject.Properties.Name -contains 'goal' -and $r.data.quran.PSObject.Properties.Name -contains 'percent')
Test-Check "sadaqah nested has currency" ($r.data.sadaqah.PSObject.Properties.Name -contains 'currency')
Test-Check "prayers.detailedPrayers count = 5" ($r.data.prayers.detailedPrayers.Count -eq 5)
Test-Check "flat adhkarCompleted alias present" ($r.data.PSObject.Properties.Name -contains 'adhkarCompleted')
Test-Check "flat prayersCompleted + prayersTotal present" ($r.data.PSObject.Properties.Name -contains 'prayersCompleted' -and $r.data.PSObject.Properties.Name -contains 'prayersTotal')

Write-Host "`n[14] PATCH /journey/adhkar (alias adhkarCompleted)" -ForegroundColor Yellow
$body = @{ categoryKey="MORNING"; completed=$true } | ConvertTo-Json
$r = Invoke-RestMethod -Uri "$base/journey/adhkar" -Method Patch -Headers $h -Body $body -ContentType "application/json"
Test-Check "morningCompleted = true" ($r.data.morningCompleted -eq $true)
Test-Check "overallCompleted present" ($null -ne $r.data.overallCompleted)
Test-Check "adhkarCompleted ALIAS present" ($r.data.PSObject.Properties.Name -contains 'adhkarCompleted')
Test-Check "adhkarCompleted == overallCompleted" ($r.data.adhkarCompleted -eq $r.data.overallCompleted)

Write-Host "`n[15] PATCH /profile/reading-preferences (quranAutoScrollEnabled)" -ForegroundColor Yellow
$body = @{ quranFontSize=28; quranAutoScrollEnabled=$true } | ConvertTo-Json
$r = Invoke-RestMethod -Uri "$base/profile/reading-preferences" -Method Patch -Headers $h -Body $body -ContentType "application/json"
Test-Check "PATCH success=true" ($r.success -eq $true)
Test-Check "quranAutoScrollEnabled field returned" ($r.data.PSObject.Properties.Name -contains 'quranAutoScrollEnabled')
Test-Check "quranAutoScrollEnabled = true" ($r.data.quranAutoScrollEnabled -eq $true)
Test-Check "fontSize clamped = 28" ($r.data.quranFontSize -eq 28)

Write-Host "`n[16] GET /journey/progress?days=3" -ForegroundColor Yellow
$r = Invoke-RestMethod -Uri "$base/journey/progress?days=3" -Method Get -Headers $h
Test-Check "periodDays = 3" ($r.data.periodDays -eq 3)
Test-Check "daily array exists" ($r.data.daily -is [array])
Test-Check "records backward alias exists" ($r.data.PSObject.Properties.Name -contains 'records')
Test-Check "summary present" ($null -ne $r.data.summary)
Test-Check "summary.totalQuranPages present" ($r.data.summary.PSObject.Properties.Name -contains 'totalQuranPages')
Test-Check "summary.daysStreak present" ($r.data.summary.PSObject.Properties.Name -contains 'daysStreak')
$d0 = $r.data.daily[0]
Test-Check "daily[0].date present" (-not [string]::IsNullOrEmpty($d0.date))
Test-Check "daily[0].adhkarCompleted present" ($d0.PSObject.Properties.Name -contains 'adhkarCompleted')
Test-Check "daily[0].prayersCompleted present" ($d0.PSObject.Properties.Name -contains 'prayersCompleted')
Test-Check "daily[0].overallPercent present" ($d0.PSObject.Properties.Name -contains 'overallPercent')

Write-Host "`n[17] PATCH /journey/prayer (FAJR)" -ForegroundColor Yellow
$body = @{ prayer="FAJR"; completed=$true } | ConvertTo-Json
$r = Invoke-RestMethod -Uri "$base/journey/prayer" -Method Patch -Headers $h -Body $body -ContentType "application/json"
Test-Check "prayer.completed = true" ($r.data.prayer.completed -eq $true)
Test-Check "prayer.nameAr present" (-not [string]::IsNullOrEmpty($r.data.prayer.nameAr))
Test-Check "detailedPrayers count = 5" ($r.data.prayers.detailedPrayers.Count -eq 5)
Test-Check "prayers.percent present" ($null -ne $r.data.prayers.percent)

Write-Host "`n[18] GET /tasbih/today + aliases" -ForegroundColor Yellow
$r = Invoke-RestMethod -Uri "$base/tasbih/today" -Method Get -Headers $h
Test-Check "count present" ($null -ne $r.data.count)
Test-Check "dhikrAr present" ($r.data.PSObject.Properties.Name -contains 'dhikrAr')
Test-Check "dailyGoal present" ($r.data.PSObject.Properties.Name -contains 'dailyGoal')
Test-Check "todayCount alias present" ($r.data.PSObject.Properties.Name -contains 'todayCount')
Test-Check "currentDhikrAr alias present" ($r.data.PSObject.Properties.Name -contains 'currentDhikrAr')

Write-Host "`n[19] GET /notifications + /unread-count" -ForegroundColor Yellow
$r1 = Invoke-RestMethod -Uri "$base/notifications" -Method Get -Headers $h
$r2 = Invoke-RestMethod -Uri "$base/notifications/unread-count" -Method Get -Headers $h
Test-Check "notifications is array" ($r1.data -is [array])
Test-Check "meta.unreadCount present" ($r1.meta.PSObject.Properties.Name -contains 'unreadCount')
Test-Check "/unread-count.data.unreadCount present" ($null -ne $r2.data.unreadCount)

Write-Host "`n[20] GET /profile/me" -ForegroundColor Yellow
$r = Invoke-RestMethod -Uri "$base/profile/me" -Method Get -Headers $h
Test-Check "profile data present" ($null -ne $r.data)
Test-Check "email matches" ($r.data.email -eq $email)
Test-Check "username present" ($null -ne $r.data.username)

Write-Host "`n[21] PATCH /journey/sadaqah amount=5" -ForegroundColor Yellow
$body = @{ amount=5 } | ConvertTo-Json
$r = Invoke-RestMethod -Uri "$base/journey/sadaqah" -Method Patch -Headers $h -Body $body -ContentType "application/json"
Test-Check "sadaqahAmount updated = 5" ($r.data.sadaqahAmount -eq 5)

Write-Host "`n[22] Quran bookmark + last-read" -ForegroundColor Yellow
$body = @{ surahId=2; ayahNumber=255; page=42; note="Ayatul Kursi Contract Test" } | ConvertTo-Json
$r = Invoke-RestMethod -Uri "$base/quran/bookmarks" -Method Post -Headers $h -Body $body -ContentType "application/json"
Test-Check "bookmark created id present" (-not [string]::IsNullOrEmpty($r.data.id))
Test-Check "surahNameAr field present" ($null -ne $r.data.surahNameAr)
Test-Check "surah nested object surah.nameAr present" ($null -ne $r.data.surah.nameAr)
Test-Check "surahNameAr not numeric" ($r.data.surahNameAr -notmatch '^\d+$')
Test-Check "ayahNumber present" ($null -ne $r.data.ayahNumber)
$bmId = $r.data.id

$body = @{ surahId=36; page=440; ayahNumber=1 } | ConvertTo-Json
$r = Invoke-RestMethod -Uri "$base/quran/last-read" -Method Put -Headers $h -Body $body -ContentType "application/json"
Test-Check "last-read set surahId=36" ($r.data.surahId -eq 36)
Test-Check "ayahNumber present" ($null -ne $r.data.ayahNumber)
Test-Check "juz present" ($null -ne $r.data.juz)
Test-Check "surahNameAr present" ($null -ne $r.data.surahNameAr)
Test-Check "surah nested object present" ($null -ne $r.data.surah)

$r = Invoke-RestMethod -Uri "$base/quran/bookmarks/$bmId" -Method Delete -Headers $h
Test-Check "bookmark deleted success" ($r.success -eq $true)

Write-Host "`n[23] GET /adhkar/progress?categoryKey=MORNING" -ForegroundColor Yellow
$r = Invoke-RestMethod -Uri "$base/adhkar/progress?categoryKey=MORNING" -Method Get -Headers $h
Test-Check "categoryKey = MORNING" ($r.data.categoryKey -eq 'MORNING')
Test-Check "markedItemId present" ($r.data.PSObject.Properties.Name -contains 'markedItemId')
Test-Check "items array present" ($r.data.items -is [array])
Test-Check "progressItemsDone present" ($r.data.PSObject.Properties.Name -contains 'progressItemsDone')

Write-Host "`n[24] POST /auth/refresh (rotation)" -ForegroundColor Yellow
$body = @{ refreshToken=$refreshToken } | ConvertTo-Json
$r = Invoke-RestMethod -Uri "$base/auth/refresh" -Method Post -Body $body -ContentType "application/json"
Test-Check "refresh success=true" ($r.success -eq $true)
Test-Check "new accessToken > 30 chars" ($r.data.tokens.accessToken.Length -gt 30)
Test-Check "new expiresIn is number" ($r.data.tokens.expiresIn -is [int])

Write-Host "`n[25] POST /auth/logout" -ForegroundColor Yellow
$body = @{ refreshToken=$r.data.tokens.refreshToken } | ConvertTo-Json
$r = Invoke-RestMethod -Uri "$base/auth/logout" -Method Post -Body $body -ContentType "application/json"
Test-Check "logout success=true" ($r.success -eq $true)

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "PART 2 (AUTH) DONE: $global:fail FAILURES" -ForegroundColor Green
Write-Host "============================================"
if ($global:fail -gt 0) { exit 1 }
