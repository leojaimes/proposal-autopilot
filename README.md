# Proposal Autopilot 🚀

> High-Conversion Upwork Proposal & Fit Scoring Engine for Senior Product Designers & Fractional Operators.

## Architecture

- **Backend**: NestJS (Port 7000) with Hexagonal Architecture.
- **Frontend**: Angular 19 (Port 7001) served by Nginx.
- **Database**: PostgreSQL 16 (Port 5438) with Prisma ORM.
- **Scraper Provider**: Apify / Upwork MCP Adapter.
- **Scoring Engine**: 40/25/20/15 Fit Score with 44 Cap Guardrail.
- **Proposal Synthesis**: Claude 3.5 Sonnet / Multi-LLM 35-word cover letter + Mermaid roadmap.

## Quick Start (Docker)

```bash
# 1. Start all services in Docker
docker compose up --build -d

# 2. Access the apps
# Frontend: http://localhost:7001
# Backend: http://localhost:7000
# Database: localhost:5438
```
