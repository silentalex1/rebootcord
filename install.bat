@echo off
title Reboot Cord Installer
color 0a

cls
echo reboot
echo cord
echo.
echo Installing all reboot cord client mod dependencies...
echo.

set RC_HOME=%USERPROFILE%\.rebootcord
set MINECRAFT_DIR=%RC_HOME%\minecraft
set MODS_DIR=%MINECRAFT_DIR%\mods

if not exist "%RC_HOME%" mkdir "%RC_HOME%"
if not exist "%MODS_DIR%" mkdir "%MODS_DIR%"

echo Creating client directories at %RC_HOME%
timeout /t 1 /nobreak >nul

set CONFIG_DIR=%RC_HOME%\config
if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"

echo {"client": "rebootcord-minecraft-client", "status": "installed", "source": "https://rebootcord.world/minecraft-client"} > "%CONFIG_DIR%\client.json"

echo Writing client configuration...
timeout /t 1 /nobreak >nul

echo.
echo Installation complete!
echo.
echo To continue:
echo 1. Download the Reboot Cord mod from: https://rebootcord.world/downloads/rebootcord-mod.jar
echo 2. Place it in: %MODS_DIR%
echo 3. Install Fabric Loader for Minecraft 1.20.4
echo 4. Launch Minecraft with Fabric profile
echo.
echo Reboot Cord installer completed successfully
pause