@echo off
echo Redirigiendo a la carpeta del proyecto...
cd /d "%~dp0"
echo Levantando base de datos MongoDB en Docker...
docker-compose -f docker-compose.db.yml up -d
echo.
echo MongoDB esta corriendo en el puerto 27017.
echo Puedes usar 'docker-compose -f docker-compose.db.yml stop' para detenerlo.
pause
