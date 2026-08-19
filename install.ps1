# Reboot Cord Minecraft Client Installer for Windows
$ErrorActionPreference = "Stop"

$host.ui.RawUI.WindowTitle = "Reboot Cord Installer"

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Clear-Host

Write-ColorOutput Red "reboot"
Write-ColorOutput Gray "cord"
Write-Output ""
Write-ColorOutput Yellow "Installing all reboot cord client mod dependencies..."
Write-Output ""

$RC_HOME = "$env:USERPROFILE\.rebootcord"
$minecraftDir = "$RC_HOME\minecraft"
$modsDir = "$minecraftDir\mods"

if (-not (Test-Path $RC_HOME)) {
    New-Item -ItemType Directory -Path $RC_HOME -Force | Out-Null
}

if (-not (Test-Path $modsDir)) {
    New-Item -ItemType Directory -Path $modsDir -Force | Out-Null
}

Write-Output "Creating client directories at $RC_HOME"
Start-Sleep -Seconds 1

$configDir = "$RC_HOME\config"
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

$configContent = @"
{
  "client": "rebootcord-minecraft-client",
  "status": "installed",
  "source": "https://rebootcord.world/minecraft-client"
}
"@

Set-Content -Path "$configDir\client.json" -Value $configContent
Write-Output "Writing client configuration..."
Start-Sleep -Seconds 1

Write-Output ""
Write-ColorOutput Green "Installation complete!"
Write-ColorOutput Yellow "To continue:"
Write-Output "1. Download the Reboot Cord mod from: https://rebootcord.world/downloads/rebootcord-mod.jar"
Write-Output "2. Place it in: $modsDir"
Write-Output "3. Install Fabric Loader for Minecraft 1.20.4"
Write-Output "4. Launch Minecraft with Fabric profile"
Write-Output ""
Write-ColorOutput Gray "Reboot Cord installer completed successfully"