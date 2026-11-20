import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sample = await prisma.sharedUpworkJob.findFirst({
    include: { segments: true },
  });
  if (!sample) {
    console.log('No shared jobs found');
    return;
  }
  console.log('ID:', sample.externalUpworkId);
  console.log('Title:', sample.title);
  console.log('Segments:', sample.segments.map((s) => s.segment));
  console.log('Payload keys:', Object.keys(sample.rawApifyPayload as object || {}));
  console.log('Sample payload snippet:', JSON.stringify(sample.rawApifyPayload).slice(0, 400));
}

main().finally(() => prisma.$disconnect());
