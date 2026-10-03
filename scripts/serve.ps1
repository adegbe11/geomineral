param([ValidateSet('api','worker','web')][string]$Service = 'web')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$env:PYTHONPATH = 'services/api'
if ($Service -eq 'api') {
    if (($env:ROCK_VISION_PROVIDER -ne 'openai') -and (Test-Path '.data/ollama-runtime/bin/ollama.exe')) { & "$PSScriptRoot/start-local-ai.ps1" }
    & .\.venv\Scripts\python.exe -m uvicorn geomineral.main:app --host 127.0.0.1 --port 8000 --no-access-log
}
elseif ($Service -eq 'worker') { & .\.venv\Scripts\python.exe -m geomineral.worker }
else { npm.cmd run dev }
