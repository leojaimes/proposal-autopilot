param(
  [string]$TokenFile = 'backend/.env.apify.history',
  [string]$OutputFile = 'backend/prisma/seeds/market-history-estimates.v1.json',
  [switch]$AllowNetwork
)

$ErrorActionPreference = 'Stop'
$selections = @(
  @{ segment = 'all-upwork'; input = @{} },
  @{ segment = 'social-media-content'; input = @{ skills = @('social media', 'content creation') } },
  @{ segment = 'translation'; input = @{ categories = @('translation') } },
  @{ segment = 'ux-ui-design'; input = @{ skills = @('ux design', 'ui design') } },
  @{ segment = 'n8n-automation'; input = @{ skills = @('n8n') } },
  @{ segment = 'gohighlevel'; input = @{ skills = @('gohighlevel') } },
  @{ segment = 'ux-research'; input = @{ skills = @('ux research', 'user research') } },
  @{ segment = 'aeo-geo'; input = @{ skills = @('answer engine optimization', 'generative engine optimization') } },
  @{ segment = 'ai-prototyping'; input = @{ skills = @('ai prototyping', 'rapid prototyping') } },
  @{ segment = 'design-systems'; input = @{ skills = @('design system') } }
)
$records = @()
if (Test-Path -LiteralPath $OutputFile) {
  $loaded = Get-Content -LiteralPath $OutputFile -Raw | ConvertFrom-Json
  foreach ($record in $loaded) { $records += $record }
}
foreach ($selection in $selections) {
  $inputBody = @{ estimate = $true; from = '2025-07-01'; to = '2026-09-30' }
  foreach ($key in $selection.input.Keys) { $inputBody[$key] = $selection.input[$key] }
  $existing = @($records | Where-Object { $_.segment -eq $selection.segment })
  if ($existing.Count -gt 1) { throw "Duplicate cached segment: $($selection.segment)" }
  if ($existing.Count -eq 1) {
    $cached = $existing[0]
    $cachedSkills = @($cached.input.skills) -join ','
    $expectedSkills = @($inputBody.skills) -join ','
    $cachedCategories = @($cached.input.categories) -join ','
    $expectedCategories = @($inputBody.categories) -join ','
    if ($cached.input.from -ne $inputBody.from -or $cached.input.to -ne $inputBody.to -or
      $cachedSkills -ne $expectedSkills -or $cachedCategories -ne $expectedCategories -or
      $cached.statusMessage -notmatch 'nothing delivered or charged' -or -not $cached.output.rows_by_month) {
      throw "Cached estimate does not match the verified selection: $($selection.segment)"
    }
    Write-Output "Skipping cached estimate: $($selection.segment)"
    continue
  }
  if (-not $AllowNetwork) { throw "Missing cached estimate: $($selection.segment). Use -AllowNetwork only after approving an Apify request." }
  $token = ((Get-Content -LiteralPath $TokenFile | Where-Object { $_ -match '^APIFY_TOKEN=' } | Select-Object -First 1) -split '=', 2)[1]
  if (-not $token) { throw 'APIFY_TOKEN is missing' }
  $headers = @{ Authorization = "Bearer $token" }
  $run = (Invoke-RestMethod -Method Post -Uri 'https://api.apify.com/v2/acts/hyperbach~upwork-jobs-history/runs?waitForFinish=60' -Headers $headers -ContentType 'application/json' -Body ($inputBody | ConvertTo-Json -Depth 5)).data
  if ($run.status -notin @('SUCCEEDED')) { throw "Estimate did not finish: $($selection.segment), run $($run.id), $($run.status)" }
  if ($run.statusMessage -notmatch 'nothing delivered or charged') { throw "Estimate was not confirmed free: $($selection.segment), run $($run.id)" }
  $output = Invoke-RestMethod -Uri "https://api.apify.com/v2/key-value-stores/$($run.defaultKeyValueStoreId)/records/OUTPUT" -Headers $headers
  if (-not $output.rows_by_month) { throw "Monthly counts missing: $($selection.segment), run $($run.id)" }
  $records += [pscustomobject]@{ segment = $selection.segment; actor = 'hyperbach/upwork-jobs-history'; runId = $run.id; observedAt = (Get-Date).ToUniversalTime().ToString('o'); input = $inputBody; statusMessage = $run.statusMessage; output = $output }
  $json = ConvertTo-Json -InputObject @($records) -Depth 12
  [System.IO.File]::WriteAllText($OutputFile, $json, [System.Text.UTF8Encoding]::new($false))
  Write-Output "$($selection.segment): $($output.rows) estimated postings; run $($run.id)"
}
