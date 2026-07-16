@echo off
echo =========================================
echo       STARTING YESUBASS MUSIC BOT
echo =========================================
echo.

echo [1/2] Starting Lavalink Audio Server in the background...
start "Lavalink Server" cmd /k "cd lavalink && java -jar Lavalink.jar"

echo Waiting 15 seconds for Lavalink to boot up completely...
timeout /t 15 /nobreak >nul

echo.
echo [2/2] Starting the Discord Bot...
npm run dev

pause
