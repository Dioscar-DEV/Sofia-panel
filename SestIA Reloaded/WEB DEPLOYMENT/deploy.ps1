# Limpia la pantalla
Clear-Host
Write-Host "=========================================================="
Write-Host "    Script de Deploy con SCP (Versión PowerShell)"
Write-Host "      (Excluyendo archivos *.md)"
Write-Host "=========================================================="

# --- CONFIGURACIÓN - ¡EDITA ESTAS VARIABLES! ---
Write-Host ""
Write-Host "[CONFIGURACION] - Cargando variables..."

# Ruta a tu llave .pem (Formato Windows)
$keyPath = "C:\Users\fmoll\OneDrive\Desktop\Conexiones SH\Maneiro\maneiro.pem"

# Ruta a la carpeta LOCAL de tu proyecto (Formato Windows)
$localFolderPath = "C:\Users\fmoll\OneDrive\Desktop\SestIA Reloaded\WEB"

# --- Datos del servidor remoto ---
$remoteUser = "ubuntu"
$remoteHost = "52.207.154.105"

# Directorio final de la página web en el servidor
$remoteLiveDir = "/var/www/sestia.manuelitoai.com/html"

# --- (No necesitas editar más abajo) ---
# Obtener el nombre de la carpeta local automáticamente
$localFolderName = Split-Path -Leaf -Path $localFolderPath

# --- ¡NUEVO! ---
# Ruta temporal local para la copia filtrada (se crea en C:\Temp\[NombreCarpeta])
$tempDeployPath = Join-Path $env:TEMP $localFolderName

# Ruta remota (apunta al home del usuario, con comillas en el nombre)
$remoteTempPath = "~/'$localFolderName'"


# --- PASO 0: CREAR COPIA LOCAL FILTRADA ---
Write-Host ""
Write-Host "[PASO 0 de 4] - Creando copia local temporal (excluyendo .md)..."
Write-Host "   FUENTE: $localFolderPath"
Write-Host "   DESTINO: $tempDeployPath"

# Usamos Robocopy para copiar todo EXCEPTO los .md
# /E -> Copia subdirectorios (recursivo)
# /XF *.md -> Excluye archivos que coincidan con *.md
# /NFL /NDL /NJH /NJS /nc /ns /np -> Flags para hacerlo "silencioso"
robocopy $localFolderPath $tempDeployPath /E /XF *.md /NFL /NDL /NJH /NJS /nc /ns /np

# Robocopy devuelve códigos 0-7 para éxito (incluso si no copió nada). 8+ es error.
if ($LASTEXITCODE -gt 7) { 
    Write-Host "[ERROR] - Robocopy falló al crear la copia temporal. Abortando."
    Read-Host "Presiona Enter para salir..."
    exit 1
}
Write-Host "[PASO 0 de 4] - Copia temporal creada."


# --- PASO 1: SUBIR ARCHIVOS CON SCP ---
Write-Host ""
Write-Host "[PASO 1 de 4] - Subiendo carpeta (filtrada) al servidor..."
Write-Host "   LOCAL (Temp): $tempDeployPath"
Write-Host "   REMOTO: ${remoteHost}:${remoteTempPath}"
Write-Host ""

# 1. Primero borramos la carpeta temporal antigua en el servidor.
ssh.exe -i $keyPath "${remoteUser}@${remoteHost}" "rm -rf $remoteTempPath"

# 2. Usamos scp.exe para subir la carpeta temporal FILTRADA.
scp.exe -i $keyPath -r $tempDeployPath "${remoteUser}@${remoteHost}:~/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] - La subida de archivos con scp falló. Abortando."
    Read-Host "Presiona Enter para salir..."
    exit 1
}
Write-Host "[PASO 1 de 4] - Subida de archivos completada."


# --- PASO 2: EJECUTAR DEPLOY EN EL SERVIDOR ---
Write-Host ""
Write-Host "[PASO 2 de 4] - Aplicando cambios en el servidor..."
Write-Host "   - Limpiando directorio antiguo..."
Write-Host "   - Moviendo archivos nuevos..."
Write-Host "   - Aplicando permisos..."
Write-Host ""

# Comandos para limpiar, mover y aplicar permisos (esta lógica no cambia)
$remoteCommands = "sudo rm -rf $remoteLiveDir/* && sudo mv $remoteTempPath/* $remoteLiveDir/ && sudo chown -R www-data:www-data $remoteLiveDir && sudo chmod -R 755 $remoteLiveDir"

ssh.exe -i $keyPath "${remoteUser}@${remoteHost}" "$remoteCommands && echo '--- Deploy en servidor: OK ---'"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] - El deploy en el servidor falló."
    Read-Host "Presiona Enter para salir..."
    exit 1
}
Write-Host "[PASO 2 de 4] - Deploy en servidor completado."


# --- PASO 3: INVALIDAR CACHÉ DEL NAVEGADOR (CACHE-BUSTING) ---
Write-Host ""
Write-Host "[PASO 3 de 4] - Invalidando caché del navegador..."

# Obtenemos el Timestamp (fecha) en formato Unix
$version = [int64](((Get-Date).ToUniversalTime()) - (Get-Date "1970-01-01")).TotalSeconds

# El comando 'sed' es de Linux, se ejecuta sin cambios en el servidor remoto
$sedCommand = "sudo sed -i ""s|\(href='styles.css\)'|\1?v=$version'|g; s|\(href='ui.css\)'|\1?v=$version'|g; s|\(src='app-init.js\)'|\1?v=$version'|g"" ${remoteLiveDir}/index.html"

ssh.exe -i $keyPath "${remoteUser}@${remoteHost}" $sedCommand

Write-Host "[PASO 3 de 4] - Caché invalidada con la versión: $version"


# --- PASO 4: LIMPIEZA LOCAL ---
Write-Host ""
Write-Host "[PASO 4 de 4] - Limpiando carpeta temporal local..."
Remove-Item -Recurse -Force -Path $tempDeployPath
Write-Host "[PASO 4 de 4] - Limpieza local completada."


# --- FINALIZADO ---
Write-Host ""
Write-Host "----------------------------------------------------------"
Write-Host ""
Write-Host "         >>> DEPLOY FINALIZADO CON ÉXITO <<<"
Write-Host ""
Write-Host "----------------------------------------------------------"
Write-Host ""
Read-Host "Presiona Enter para cerrar la ventana..."