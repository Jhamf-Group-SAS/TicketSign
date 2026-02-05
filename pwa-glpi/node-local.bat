@echo off
set "NODE_PATH=c:\Users\cgongora\Documents\Proyectos\mantenimiento glpi\node-root\node-v20.11.0-win-x64"
set "PATH=%NODE_PATH%;%PATH%"

if "%1"=="npm" (
    shift
    call "%NODE_PATH%\npm.cmd" %*
) else if "%1"=="npx" (
    shift
    call "%NODE_PATH%\npx.cmd" %*
) else (
    "%NODE_PATH%\node.exe" %*
)
