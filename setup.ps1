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

Set-Location ..