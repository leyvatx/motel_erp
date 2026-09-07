# Mantiene despierta la API de Render desde esta máquina.
#
# El despertador de verdad es .github/workflows/despertador.yml, que corre en
# los runners de GitHub y no depende de que nadie deje una computadora
# encendida. Este script es para cuando eso no sirve: una demo en vivo donde no
# se puede esperar los ~50 s del arranque en frío, GitHub Actions caído, o el
# repo en una rama donde el cron no dispara.
#
# Sondea /api/health y no /api/v1/health/. La primera solo dice si el
# contenedor está en pie; la segunda revisa base y caché y contesta 503 cuando
# Redis parpadea, que no tiene nada que ver con estar dormido y solo llenaría
# la bitácora de fallas que no son.
#
# Uso normal (deja la ventana abierta, Ctrl+C para parar):
#   .\scripts\keep_alive.ps1
#
# En segundo plano, sin ventana, hasta cerrar sesión de Windows:
#   Start-Process powershell -WindowStyle Hidden -ArgumentList `
#     '-ExecutionPolicy','Bypass','-File','.\scripts\keep_alive.ps1'
#
# Para detenerlo:
#   Get-Process powershell | Where-Object { $_.CommandLine -like '*keep_alive*' } | Stop-Process

param(
    [string]$Url = "https://motel-erp-api.onrender.com/api/health",
    [int]$MinutosEntrePings = 10,
    # Vacío = a la vista, en la consola. Con ruta, se escribe ahí (útil en segundo plano).
    [string]$Bitacora = ""
)

$ErrorActionPreference = "Stop"

function Escribir([string]$texto) {
    $linea = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $texto
    if ($Bitacora) { Add-Content -Path $Bitacora -Value $linea } else { Write-Output $linea }
}

Escribir "Despertador local iniciado. $Url cada $MinutosEntrePings min."

while ($true) {
    $reloj = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        # 180 s porque un arranque en frío de Render tarda ~50 s y a veces más;
        # cortar antes reporta una falla que en realidad era el despertar.
        $respuesta = Invoke-WebRequest -Uri $Url -TimeoutSec 180 -UseBasicParsing
        Escribir ("ok    http={0} en {1:n1}s" -f $respuesta.StatusCode, $reloj.Elapsed.TotalSeconds)
    }
    catch {
        # Un ping fallido no detiene el ciclo: la causa más común es que Render
        # esté justo reiniciando, y el siguiente intento lo encuentra arriba.
        Escribir ("FALLA {0}" -f $_.Exception.Message)
    }

    Start-Sleep -Seconds ($MinutosEntrePings * 60)
}
