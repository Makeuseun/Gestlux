param(
  [Parameter(Mandatory = $true)]
  [string]$Mensagem
)

$ErrorActionPreference = 'Stop'

function Verificar($etapa) {
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Falhou: $etapa" -ForegroundColor Red
    exit $LASTEXITCODE
  }
}

Write-Host "Publicando Gestlux: $Mensagem" -ForegroundColor Cyan

git add -A
Verificar 'git add'
git commit -m $Mensagem
Verificar 'git commit'
git push origin main
Verificar 'git push'

if ($env:VERCEL_DEPLOY_HOOK_URL) {
  Write-Host 'Disparando deploy manual na Vercel...' -ForegroundColor Cyan
  Invoke-RestMethod -Method Post -Uri $env:VERCEL_DEPLOY_HOOK_URL | Out-Null
  Write-Host 'Deploy solicitado na Vercel.' -ForegroundColor Green
} else {
  Write-Host 'Push enviado. A Vercel vai publicar automaticamente se o projeto estiver importado pelo GitHub.' -ForegroundColor Green
}
