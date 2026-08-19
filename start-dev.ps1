# Start backend + browser-sync together
Write-Host "Starting backend..." -ForegroundColor Cyan
$backend = Start-Process -FilePath "node" -ArgumentList "src/app.js" -WorkingDirectory "$PSScriptRoot\backend" -PassThru -NoNewWindow

Write-Host "Starting frontend dev server with live reload..." -ForegroundColor Cyan
Start-Sleep -Seconds 1

# browser-sync serves frontend and watches for file changes
npx browser-sync start `
  --server "$PSScriptRoot\frontend" `
  --files "$PSScriptRoot\frontend\**\*.html, $PSScriptRoot\frontend\**\*.js, $PSScriptRoot\frontend\**\*.css" `
  --port 5500 `
  --no-notify `
  --no-ghost-mode

# Kill backend when browser-sync exits
Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
