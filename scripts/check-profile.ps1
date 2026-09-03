$base = "https://noor-app-backend-one.vercel.app/api/v1"
$email = "test-contract-final-" + [Guid]::NewGuid().ToString("N").Substring(0,8) + "@noor.app"
$body = @{ fullName="Mariam Final Test"; email=$email; password="Test@1234" } | ConvertTo-Json
$s = Invoke-RestMethod -Uri "$base/auth/sign-up" -Method Post -Body $body -ContentType "application/json"
$h = @{ Authorization = "Bearer " + $s.data.tokens.accessToken }
Write-Host "=== GET /profile/me fields ===" -ForegroundColor Cyan
$p = Invoke-RestMethod -Uri "$base/profile/me" -Method Get -Headers $h
$p.data.PSObject.Properties.Name | Sort-Object | ForEach-Object { Write-Host "  - $_ = $($p.data.$_)" }
Write-Host "`n=== GET /auth/me fields (subset - BASIC auth shape only) ===" -ForegroundColor Yellow
$a = Invoke-RestMethod -Uri "$base/auth/me" -Method Get -Headers $h
$a.data.PSObject.Properties.Name | Sort-Object | ForEach-Object { Write-Host "  - $_ = $($a.data.$_)" }
Write-Host "`n=== profile/me has quranAutoScrollEnabled? ===" -ForegroundColor Cyan
Write-Host "  Value in profile/me = $($p.data.quranAutoScrollEnabled)"
if ($p.data.quranAutoScrollEnabled -ne $null) { Write-Host "  ✅ EXISTS in GET /profile/me (CORRECT location per §11 contract)" -ForegroundColor Green } else { Write-Host "  ❌ MISSING" -ForegroundColor Red }
Write-Host "`n=== Checking quranReciter default in profile/me ==="
Write-Host "  quranReciter = $($p.data.quranReciter)"
Write-Host "  quranTafsir = $($p.data.quranTafsir)"
Write-Host "  quranTranslation = $($p.data.quranTranslation)"
Write-Host "  quranFontSize = $($p.data.quranFontSize)"
# logout
$body2 = @{ refreshToken=$s.data.tokens.refreshToken } | ConvertTo-Json
Invoke-RestMethod -Uri "$base/auth/logout" -Method Post -Body $body2 -ContentType "application/json" | Out-Null
Write-Host "`n✅ Profile/me quranAutoScrollEnabled check done" -ForegroundColor Green
