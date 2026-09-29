@echo off
cd /d "%~dp0"
if exist data\db.json del /q data\db.json
echo Event data reset. Start the server again.
pause
