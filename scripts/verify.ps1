# UP Police Directory and Realtime Messenger - Full Test Gate Verification Script
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  UP POLICE APPLICATION - MANDATORY TEST GATE VERIFICATION" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$testResults = @{}

# 1. Typecheck
Write-Host "`n[1/6] Running TypeScript Typecheck..." -ForegroundColor Yellow
try {
    npx.cmd tsc --noEmit
    Write-Host "PASS: Typecheck Passed" -ForegroundColor Green
    $testResults["Typecheck"] = "PASS"
} catch {
    Write-Host "FAIL: Typecheck Failed: $_" -ForegroundColor Red
    $testResults["Typecheck"] = "FAIL"
}

# 2. Strict English-Only Validation and RBAC Unit Tests
Write-Host "`n[2/6] Running Strict Canonical Validation Unit Tests..." -ForegroundColor Yellow
try {
    npx.cmd vitest run tests/unit/validation.test.ts
    Write-Host "PASS: Validation Unit Tests Passed" -ForegroundColor Green
    $testResults["UnitTests"] = "PASS"
} catch {
    Write-Host "FAIL: Unit Tests Failed: $_" -ForegroundColor Red
    $testResults["UnitTests"] = "FAIL"
}

# 3. Integration Tests (Auth, Directory, Transfers, Chat, Notices, Excel Import)
Write-Host "`n[3/6] Running API and Workflow Integration Tests..." -ForegroundColor Yellow
try {
    npx.cmd vitest run tests/integration/auth.test.ts tests/integration/directory.test.ts tests/integration/transfers.test.ts tests/integration/chat.test.ts tests/integration/notices.test.ts tests/integration/excel-import.test.ts
    Write-Host "PASS: Integration Tests Passed" -ForegroundColor Green
    $testResults["IntegrationTests"] = "PASS"
} catch {
    Write-Host "FAIL: Integration Tests Failed: $_" -ForegroundColor Red
    $testResults["IntegrationTests"] = "FAIL"
}

# 4. Security and Compliance Tests (No In-App Calling, No Hide Phone, Android Manifest)
Write-Host "`n[4/6] Running Security and Calling Absence Compliance Tests..." -ForegroundColor Yellow
try {
    npx.cmd vitest run tests/security/no-calling.test.ts tests/security/android-manifest.test.ts
    Write-Host "PASS: Security Compliance Tests Passed" -ForegroundColor Green
    $testResults["SecurityTests"] = "PASS"
} catch {
    Write-Host "FAIL: Security Tests Failed: $_" -ForegroundColor Red
    $testResults["SecurityTests"] = "FAIL"
}

# 5. Database Migration and 6-Hour Backup Routine
Write-Host "`n[5/6] Testing Database Migrations, Seeding and 6-Hour Backup..." -ForegroundColor Yellow
try {
    node scripts/migrate.js
    node scripts/seed.js
    node scripts/backup.js
    Write-Host "PASS: Database and Backup Verification Passed" -ForegroundColor Green
    $testResults["DatabaseAndBackup"] = "PASS"
} catch {
    Write-Host "FAIL: Database / Backup Failed: $_" -ForegroundColor Red
    $testResults["DatabaseAndBackup"] = "FAIL"
}

# 6. Web and PWA Production Build
Write-Host "`n[6/6] Verifying Web and PWA Production Build..." -ForegroundColor Yellow
try {
    npm.cmd run build --workspace=@police-directory/web
    Write-Host "PASS: Production Web and PWA Build Passed" -ForegroundColor Green
    $testResults["PwaBuild"] = "PASS"
} catch {
    Write-Host "FAIL: Web Build Failed: $_" -ForegroundColor Red
    $testResults["PwaBuild"] = "FAIL"
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "  TEST GATE EXECUTION SUMMARY" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
foreach ($key in $testResults.Keys) {
    $status = $testResults[$key]
    if ($status -eq "PASS") {
        Write-Host "  [$status] $key" -ForegroundColor Green
    } else {
        Write-Host "  [$status] $key" -ForegroundColor Red
    }
}

$allPass = $true
foreach ($val in $testResults.Values) {
    if ($val -ne "PASS") { $allPass = $false }
}

if ($allPass) {
    Write-Host "`n>>> ALL MANDATORY TEST GATE CHECKS PASSED SUCCESSFULLY <<<`n" -ForegroundColor Green
} else {
    Write-Host "`n>>> ONE OR MORE MANDATORY CHECKS FAILED <<<`n" -ForegroundColor Red
    exit 1
}
