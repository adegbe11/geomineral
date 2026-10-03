$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $repo '.data/ollama-runtime/bin/ollama.exe'
if (-not (Test-Path -LiteralPath $runtime)) { throw 'Ollama runtime is missing from .data/ollama-runtime/bin.' }
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_MODELS = Join-Path $repo '.data/ollama-models'
$env:OLLAMA_NO_CLOUD = '1'
$env:OLLAMA_NUM_PARALLEL = '1'
$env:OLLAMA_MAX_LOADED_MODELS = '1'
try {
    $null = Invoke-RestMethod 'http://127.0.0.1:11434/api/version' -TimeoutSec 2
    Write-Output 'Local AI is already running.'
    return
} catch {}
Start-Process -FilePath $runtime -ArgumentList 'serve' -WorkingDirectory $repo -WindowStyle Hidden -RedirectStandardOutput (Join-Path $repo '.data/ollama-runtime/server.log') -RedirectStandardError (Join-Path $repo '.data/ollama-runtime/server-error.log') | Out-Null
foreach ($attempt in 1..15) {
    try {
        $null = Invoke-RestMethod 'http://127.0.0.1:11434/api/version' -TimeoutSec 2
        Write-Output 'Local AI started. GeoMineral uses qwen3-vl:2b by default.'
        return
    } catch { Start-Sleep -Seconds 1 }
}
throw 'Local AI did not start. Check .data/ollama-runtime/server-error.log.'
