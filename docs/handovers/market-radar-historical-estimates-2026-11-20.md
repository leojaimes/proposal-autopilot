# Historical Market Radar estimates

## Verified local result

The Radar now shows a separate Upwork-wide historical comparison. PostgreSQL holds ten raw Apify estimate outputs: nine category filters plus one unfiltered Upwork denominator. The local UI reads them through the existing Radar API. No live job records were downloaded for this table.

Source: `hyperbach/upwork-jobs-history`, estimate mode. The committed seed is `backend/prisma/seeds/market-history-estimates.v1.json`; each record retains the exact actor input, monthly output, run ID, observation time, and the actor's `nothing delivered or charged` status. The actor reported no delivered or charged postings for these ten runs. Account billing was not independently audited.

The fixed comparison window is July–September 2026. `Postings/mo` is that quarter's category total divided by three. Year-over-year and momentum are percentage changes in **category share of all Upwork postings**, against July–September 2025 and April–June 2026 respectively. A missing month or zero baseline yields `Insufficient data`; a missing month is never inferred to be zero postings.

The actor filters use Upwork skill/category selections and are proxies for the Radar labels. They differ from the filters and time window behind the earlier reference table (for example, the current social-media estimate is 16,149 postings/month versus the reference 13,700). Do not present the two tables as identical measurements or merge these estimates into tenant opportunity scores.

## Local verification

- Prisma migration `20261120150000_market_historical_estimates` was applied to the local Docker PostgreSQL database; ten rows were imported.
- Backend build passed; focused backend tests passed 10/10; Angular build passed; focused component test passed 1/1.
- Docker backend and frontend were rebuilt. Sandbox QA passed 2/2 with a read-only Playwright flow: `.sandbox/runs/2026-11-20T15-05-01-736Z-5d892b8c/visual/checkpoints/historical-market-comparison.png`.
- `backend/scripts/collect-market-history-estimates.ps1` now skips matching cached records. Without `-AllowNetwork`, it refuses to request any missing segment. An offline run with a nonexistent token file skipped all ten cached records.

## Restore to another database

Apply the Prisma migration, then import the committed seed from `backend/`:

```powershell
npx prisma migrate deploy
npx ts-node --transpile-only scripts/import-market-history-estimates.ts
```

Set `DATABASE_URL` for the target database before these commands. The importer upserts by segment, so re-importing the same seed does not duplicate rows. This restore procedure has been executed only against the local Docker database; production has not been changed.
