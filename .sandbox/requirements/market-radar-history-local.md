# Requirement: Local Historical Market Comparison

## Scope

Verify the Market Radar reads persisted Apify estimate results through PostgreSQL and the backend. The test must not launch scraping.

## Acceptance criteria

1. The historical comparison displays nine category estimates with an explicit archive source and filter.
2. A comparison with missing archive months displays insufficient data.
3. The historical estimates remain separate from the shared scraped-job evidence.
