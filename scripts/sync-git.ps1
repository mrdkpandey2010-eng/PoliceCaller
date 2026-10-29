param (
    [Parameter(Mandatory=$true, HelpMessage="Enter your Git repository remote URL (e.g. https://github.com/username/police-directory-app.git)")]
    [string]$RemoteUrl
)

$ErrorActionPreference = "Stop"

Write-Host "--- Syncing UP Police Application to Git Remote ---" -ForegroundColor Cyan
Write-Host "Remote URL: $RemoteUrl" -ForegroundColor Yellow

# Check if origin already exists
$existingRemote = git.exe remote get-url origin 2>$null
if ($existingRemote) {
    Write-Host "Updating existing origin remote URL..."
    git.exe remote set-url origin $RemoteUrl
} else {
    Write-Host "Adding new origin remote URL..."
    git.exe remote add origin $RemoteUrl
}

Write-Host "Pushing main branch to remote..." -ForegroundColor Cyan
git.exe push -u origin main

Write-Host "✓ Successfully synced code to Git remote repository!" -ForegroundColor Green
