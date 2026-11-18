param(
  [Parameter(Mandatory = $true)]
  [string]$Mensagem
)

$ErrorActionPreference = 'Stop'

Write-Host "Publicando Gestlux: $Mensagem" -ForegroundColor Cyan

git add -A
git commit -m $Mensagem
git push origin main

if ($env:VERCEL_DEPLOY_HOOK_URL) {
  Write-Host 'Disparando deploy manual na Vercel...' -ForegroundColor Cyan
  Invoke-RestMethod -Method Post -Uri $env:VERCEL_DEPLOY_HOOK_URL | Out-Null
  Write-Host 'Deploy solicitado na Vercel.' -ForegroundColor Green
} else {
  Write-Host 'Push enviado. A Vercel vai publicar automaticamente se o projeto estiver importado pelo GitHub.' -ForegroundColor Green
}
