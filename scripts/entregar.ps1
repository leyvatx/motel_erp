# Deja un despliegue listo para entregárselo a un cliente. Versión de PowerShell.
#
# Hace dos cosas en orden: retira la sucursal sembrada al instalar -- la que se
# llama "Motel Demo", "Negocio Demo" o como haya quedado -- y crea la cuenta de
# quien va a recibir el sistema, con una contraseña inventada en el momento.
#
# La cadena de conexión se lee de api\.env.render y nunca se imprime: de ella
# solo se muestra el host, para confirmar contra qué base se trabaja. La
# contraseña generada tampoco sale a la pantalla; queda en un archivo que el
# script indica al terminar. Los dos archivos están fuera de git.
#
# Uso:
#   .\scripts\entregar.ps1 -Slug motel-demo -Email admin@empresa.com -Nombre "Administrador"

param(
    [Parameter(Mandatory = $true)][string]$Slug,
    [Parameter(Mandatory = $true)][string]$Email,
    [string]$Nombre = "Administrador"
)

$ErrorActionPreference = "Stop"

$Raiz = Split-Path -Parent $PSScriptRoot
$Credenciales = Join-Path $Raiz "api\.env.render"
$DestinoClave = Join-Path $Raiz "api\.clave-cliente.txt"
$Python = Join-Path $Raiz "api\.venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    Write-Error "No encuentro el intérprete en $Python."
}

if (-not (Test-Path $Credenciales)) {
    Write-Output "No encuentro $Credenciales."
    Write-Output "Crea ese archivo y pega dentro la External Database URL de Render."
    exit 1
}

# Se acepta el archivo con prefijo (DATABASE_URL=postgres://...) o solo la URL
# pelona, que es como sale del botón de copiar de Render.
$Url = ""
foreach ($linea in Get-Content $Credenciales) {
    $limpia = $linea.Trim()
    if ($limpia -eq "" -or $limpia.StartsWith("#")) { continue }
    if ($limpia -match '^DATABASE_URL\s*=\s*(.+)$') { $Url = $Matches[1].Trim(); break }
    if ($limpia -match '^postgres') { $Url = $limpia; break }
}

if ([string]::IsNullOrWhiteSpace($Url)) {
    Write-Output "$Credenciales no contiene una cadena de conexión."
    Write-Output "Debe tener una línea que empiece con postgres:// o postgresql://"
    exit 1
}

$env:DATABASE_URL = $Url

# Del secreto solo se enseña a dónde apunta.
$Host_ = "desconocido"
if ($Url -match '@([^/]+)/') { $Host_ = $Matches[1] }
Write-Output "Base de datos: $Host_"
if ($Host_ -like "*localhost*" -or $Host_ -like "*127.0.0.1*") {
    Write-Output ""
    Write-Output "OJO: eso es tu base LOCAL, no la de Render. Revisa api\.env.render."
}
Write-Output ""

Push-Location (Join-Path $Raiz "api")
try {
    Write-Output "-- Paso 1 de 3: que se va a retirar --------------------------------"
    & $Python manage.py reset_tenant --slug $Slug --retirar
    Write-Output ""

    $respuesta = Read-Host "Escribe SI en mayusculas para retirar esa sucursal"
    if ($respuesta -cne "SI") {
        Write-Output "Cancelado. No se toco nada."
        exit 0
    }

    Write-Output ""
    Write-Output "-- Paso 2 de 3: retirando -----------------------------------------"
    & $Python manage.py reset_tenant --slug $Slug --retirar --si

    Write-Output ""
    Write-Output "-- Paso 3 de 3: creando la cuenta del cliente ----------------------"
    # La salida completa va al archivo; a la pantalla solo lo que no es secreto.
    & $Python manage.py create_client_admin --email $Email --nombre $Nombre --generar-clave |
        Out-File -FilePath $DestinoClave -Encoding utf8

    Get-Content $DestinoClave | Where-Object { $_ -notmatch 'Contrase' }

    Write-Output ""
    Write-Output "La contrasena quedo en:"
    Write-Output "  $DestinoClave"
    Write-Output ""
    Write-Output "Abrelo, copiala al canal por el que se la vas a entregar al cliente,"
    Write-Output "y borra el archivo. No se puede volver a mostrar."
}
finally {
    Pop-Location
    Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
}
