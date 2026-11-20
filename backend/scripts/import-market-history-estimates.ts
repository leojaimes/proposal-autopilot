import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

type Estimate = { segment: string; actor: string; runId: string; observedAt: string; input: Record<string, unknown>; output: Record<string, unknown>; statusMessage: string };
const prisma = new PrismaClient();

async function main() {
  const path = process.argv[2] ?? 'prisma/seeds/market-history-estimates.v1.json';
  const records = JSON.parse(readFileSync(path, 'utf8')) as Estimate[];
  if (records.length !== 10 || records.some((record) => !record.statusMessage.includes('nothing delivered or charged') || !record.output.rows_by_month)) {
    throw new Error('Expected ten verified, free monthly estimate records');
  }
  for (const record of records) {
    const data = { actor: record.actor, runId: record.runId, observedAt: new Date(record.observedAt), input: record.input, output: record.output };
    await prisma.marketHistoricalEstimate.upsert({ where: { segment: record.segment }, create: { segment: record.segment, ...data }, update: data });
  }
  console.log(`Imported ${records.length} historical estimate records`);
}

main().finally(() => prisma.$disconnect());
