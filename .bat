@echo off
echo Starting..

:main
node deploy/deployCommands.js
node index.js
echo Restarting..
goto main