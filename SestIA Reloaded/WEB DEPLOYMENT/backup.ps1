# Limpia la pantalla
Clear-Host
Write-Host "=========================================================="
Write-Host "    Script de Backup con SCP (Descargar desde Servidor)"
Write-Host "=========================================================="

# --- CONFIGURACIÓN - ¡EDITA ESTAS VARIABLES! ---
Write-Host ""
Write-Host "[CONFIGURACION] - Cargando variables..."

# ¡IMPORTANTE! Usa rutas de Windows (ej. "C:\...")
# Ruta a tu llave .pem
$keyPath = "C:\Users\fmoll\OneDrive\Desktop\Conexion sh amazon dieguito\smart.pem"

# Ruta LOCAL donde se guardará la copia de seguridad (usa formato Windows)
$localBackupPath = "C:\Users\fmoll\OneDrive\Documents\Hospital\hospitalito_backup"

# --- Datos del servidor remoto (estos no cambian) ---
$remoteUser = "ubuntu"
$remoteHost = "34.207.101.151"

# Directorio de la web en el SERVIDOR (¡El que quieres descargar!)
$remoteLiveDir = "/var/www/hospitalito.dieguitoai.com/html"


# --- PASO 1: PREPARAR CARPETA LOCAL ---
Write-Host ""
Write-Host "[PASO 1 de 2] - Preparando carpeta de backup local..."

# Comando de PowerShell para crear la carpeta (equivale a 'mkdir -p')
New-Item -ItemType Directory -Force -Path $localBackupPath | Out-Null

if (-not (Test-Path $localBackupPath)) {
    Write-Host "[ERROR] - No se pudo crear la carpeta local $localBackupPath. Abortando."
    Read-Host "Presiona Enter para salir..."
    exit 1
}
Write-Host "  Directorio local listo: $localBackupPath"


# --- PASO 2: DESCARGAR ARCHIVOS CON SCP ---
Write-Host ""
Write-Host "[PASO 2 de 2] - Descargando archivos del servidor..."
Write-Host "   DESDE (Remoto): ${remoteUser}@${remoteHost}:${remoteLiveDir}"
Write-Host "   HACIA (Local):  $localBackupPath"
Write-Host ""

# Usamos scp.exe (que viene con PowerShell/OpenSSH en Windows)
# La sintaxis del comando scp es idéntica
scp.exe -i $keyPath -r "${remoteUser}@${remoteHost}:${remoteLiveDir}" $localBackupPath

# Revisamos si el último comando (scp) falló
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] - La descarga de archivos con scp falló. Abortando."
    Read-Host "Presiona Enter para salir..."
    exit 1
}


# --- FINALIZADO ---
Write-Host ""
Write-Host "----------------------------------------------------------"
Write-Host ""
Write-Host "         >>> BACKUP FINALIZADO CON ÉXITO <<<"
Write-Host ""
Write-Host "   Tus archivos se han guardado en:"
Write-Host "   $localBackupPath\html"
Write-Host "----------------------------------------------------------"
Write-Host ""
Read-Host "Presiona Enter para cerrar la ventana..."