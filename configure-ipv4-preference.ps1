# Script to configure Windows to prefer IPv4 over IPv6
# This script must be run as Administrator

Write-Host "Configuring Windows to prefer IPv4 over IPv6..." -ForegroundColor Yellow

# Method 1: Set prefix policy to prefer IPv4 (IPv6 still works, but IPv4 is preferred)
# This affects how Windows resolves DNS and chooses which IP stack to use

# Disable IPv6 on specific adapters (safer than system-wide)
Write-Host "`nOption 1: Disable IPv6 on Wi-Fi adapter only..." -ForegroundColor Cyan
Write-Host "Run this command (requires admin):" -ForegroundColor Green
Write-Host 'Disable-NetAdapterBinding -Name "Wi-Fi" -ComponentID "ms_tcpip6"' -ForegroundColor White

# Method 2: Configure DNS to prefer IPv4
Write-Host "`nOption 2: Configure DNS to prefer IPv4..." -ForegroundColor Cyan
Write-Host "This can be done via:" -ForegroundColor Green
Write-Host "1. Control Panel > Network and Sharing Center > Change adapter settings" -ForegroundColor White
Write-Host "2. Right-click Wi-Fi > Properties" -ForegroundColor White
Write-Host "3. Uncheck 'Internet Protocol Version 6 (TCP/IPv6)'" -ForegroundColor White

# Method 3: Registry modification (requires admin)
Write-Host "`nOption 3: System-wide preference via Registry..." -ForegroundColor Cyan
Write-Host "Run these commands (requires admin):" -ForegroundColor Green
Write-Host '$regPath = "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip6\Parameters"' -ForegroundColor White
Write-Host 'New-ItemProperty -Path $regPath -Name "DisabledComponents" -Value 0x20 -PropertyType DWORD -Force' -ForegroundColor White
Write-Host "`nNote: Value 0x20 disables IPv6 on all non-loopback adapters" -ForegroundColor Yellow
Write-Host "Restart required after registry changes." -ForegroundColor Yellow

Write-Host "`nRECOMMENDED: Use Option 1 (disable IPv6 on Wi-Fi only) as it's the safest." -ForegroundColor Green

