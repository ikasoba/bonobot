#!/usr/bin/env pwsh

function ExistsCommand($command){
  try {
    Get-Command pwsh > $null;
    return $true;
  } catch {
    return $false;
  }
}

if (-not (ExistsCommand pnpm)) {
  npm i -g pnpm
}

Set-Location .\bot

pnpm install

if (-not (Test-Path ./TOKEN.txt)){
  $token = Read-Host "トークンを入力してください"

  $token > ./TOKEN.txt
}

Set-Location ..