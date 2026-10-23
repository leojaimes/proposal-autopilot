# Market Radar live runbook

Use PowerShell from the repository root.

## 1. Check state before spending Apify credits

```powershell
Get-Content backend/.env | Select-String '^APIFY_TOKEN=' | ForEach-Object { 'APIFY_TOKEN=configured' }
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker exec proposal_autopilot_db psql -U postgres -d proposal_autopilot_db -c 'SELECT id,status,jobs_found,started_at,finished_at FROM batch_runs ORDER BY started_at DESC LIMIT 3;'
```

The current actor is logged in `backend/src/modules/scraping/apify.service.ts` as `flash_mage/upwork`. Its input schema currently accepts at most five search queries, so compare requested keywords with the actor payload before reporting coverage.

## 2. Trigger the live batch only when needed

```powershell
$body = @{ keywords = @('UX research','design system','Figma design system','AI product design','usability testing','AI prototyping','vibe coding','agentic workflow design','N8N automation design','GenAI UX'); maxResults = 20 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:7000/api/scraping/trigger' -Headers @{ 'x-tenant-id' = '00000000-0000-0000-0000-000000000001' } -ContentType 'application/json' -Body $body
```

Poll `batch_runs` until terminal. Validate real `upwork.com/jobs/...` URLs and structured fields before trusting the batch.

## 3. Verify the Radar without destructive fixture operations

```powershell
npm run sandbox:run -- --requirement .sandbox/requirements/market-radar-live-e2e.md --visual-plan .sandbox/visual-plans/market-radar-live-e2e.json --remote --target nielsen --url http://127.0.0.1:7001
```

Use fixture mode only on an empty or isolated snapshot set. If snapshots already exist, do not run fixture cleanup: it is allowed to remove the tenant's persisted snapshots.
