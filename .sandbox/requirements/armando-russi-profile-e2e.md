# Requirement: Armando Russi Profile Ingestion & Calibration E2E

## Scope

Ingest Armando Russi's positioning PDF (`armando-positioning.pdf`) through the UI as `armandorussi@gmail.com`, synthesize profile taxonomy and proof stories with Gemini 3.8 Flash, activate the profile in PostgreSQL, and inspect the Market Radar initial state.

## Acceptance criteria

1. Armando Russi's authenticated session accesses the dispatch cabina.
2. The calibration modal accepts the positioning PDF and Gemini 3.8 Flash synthesizes proof stories and roles.
3. Activating the profile sets Armando Russi as the active profile in PostgreSQL.
4. The Market Radar loads for the activated profile.
