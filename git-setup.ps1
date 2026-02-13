$env:PATH = "C:\Users\PC\AppData\Local\nodejs;" + $env:PATH
Set-Location "C:\Users\PC\OneDrive\Desktop\PhongdepHN"

# Cau hinh Git (chi can 1 lan)
git config user.email "phongdephn@gmail.com"
git config user.name "PhongDepHN"

# Tao commit
git add .
git commit -m "Initial commit - PhongDepHN"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  DONE! Code da san sang." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Bay gio ban can:"
Write-Host "1. Tao repo tren GitHub.com (ten: phongdephn, chon Private)"
Write-Host "2. Quay lai day chay lenh:"
Write-Host ""
Write-Host '   git remote add origin https://github.com/TEN_CUA_BAN/phongdephn.git' -ForegroundColor Yellow
Write-Host '   git branch -M main' -ForegroundColor Yellow
Write-Host '   git push -u origin main' -ForegroundColor Yellow
Write-Host ""
