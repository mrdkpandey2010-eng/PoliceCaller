# Cloudflare Deployment Automation Script for UP Police Directory & Messenger
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  CLOUDFLARE PRODUCTION DEPLOYMENT ENGINE" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check Wrangler authentication
Write-Host "`n[1/4] Verifying Cloudflare Authentication..." -ForegroundColor Yellow
$authCheck = npx.cmd wrangler whoami 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not authenticated to Cloudflare. Launching OAuth login in browser..." -ForegroundColor Yellow
    npx.cmd wrangler login
} else {
    Write-Host "✓ Cloudflare authentication confirmed." -ForegroundColor Green
}

# 2. Build Web Frontend & PWA
Write-Host "`n[2/4] Compiling Production Web & PWA Bundle..." -ForegroundColor Yellow
npm.cmd run build --workspace=@police-directory/web
Write-Host "✓ Web bundle compiled at apps/web/dist" -ForegroundColor Green

# 3. Deploy Worker API & D1
Write-Host "`n[3/4] Deploying Cloudflare Workers API Gateway..." -ForegroundColor Yellow
Set-Location -Path "apps/api"
npx.cmd wrangler deploy
Set-Location -Path "../.."
Write-Host "✓ Cloudflare Worker deployed." -ForegroundColor Green

# 4. Deploy Cloudflare Pages (Frontend)
Write-Host "`n[4/4] Deploying Frontend PWA to Cloudflare Pages..." -ForegroundColor Yellow
npx.cmd wrangler pages deploy apps/web/dist --project-name=police-directory-app
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "✓ UP POLICE PORTAL IS NOW LIVE ON CLOUDFLARE!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
