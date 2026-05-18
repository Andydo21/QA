$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$collection = Join-Path $root "collections/finance-api.postman_collection.json"
$environment = Join-Path $root "environments/local.postman_environment.json"
$reportDir = Join-Path $root "..\reports\newman"
$reportPath = Join-Path $reportDir "report.html"
$jsonReportPath = Join-Path $reportDir "report.json"

if (-not (Test-Path $reportDir)) {
  New-Item -ItemType Directory -Path $reportDir | Out-Null
}

npx newman run $collection -e $environment -r cli,htmlextra,json --reporter-htmlextra-export $reportPath --reporter-json-export $jsonReportPath

node (Join-Path $PSScriptRoot "cleanup-db.js")
