import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000001';

async function main() {
  console.log('🌱 Iniciando Seed de Estado Seguro para Proposal Autopilot...');

  // 1. Workspace por defecto
  const tenant = await prisma.tenant.upsert({
    where: { id: DEFAULT_TENANT_ID },
    update: {
      name: 'Default Workspace',
      slug: 'default-workspace',
      baseHourlyRate: 65.00,
      monthlyConnectsBudget: 150,
    },
    create: {
      id: DEFAULT_TENANT_ID,
      name: 'Default Workspace',
      slug: 'default-workspace',
      baseHourlyRate: 65.00,
      monthlyConnectsBudget: 150,
      upworkProfileUrl: 'https://www.upwork.com/freelancers/~example',
    },
  });
  console.log(`✅ Tenant verificado: ${tenant.name} (${tenant.id})`);

  // 2. Configuración de Scraping verificada
  const existingConfig = await prisma.scrapeConfig.findFirst({
    where: { tenantId: tenant.id },
  });

  if (!existingConfig) {
    await prisma.scrapeConfig.create({
      data: {
        tenantId: tenant.id,
        searchKeywords: ['UX Designer', 'Product Designer', 'Design Systems', 'AI UX', 'Figma'],
        minBudgetFixed: 1000.00,
        minHourlyRate: 45.00,
        recencyDays: 3,
        verifiedPaymentOnly: true,
      },
    });
    console.log('✅ ScrapeConfig base creado.');
  }

  // 3. Perfil de Posicionamiento base (Bo: Senior AI UX Designer)
  let profile = await prisma.positioningProfile.findFirst({
    where: { tenantId: tenant.id },
  });

  if (!profile) {
    profile = await prisma.positioningProfile.create({
      data: {
        tenantId: tenant.id,
        offerHeadline: 'AI Interaction & Agentic UX Designer (0-to-1 & Scale)',
        targetAudience: 'Seed to Series B AI Startups, Enterprise Design System teams, and SaaS founders.',
        voiceRules: ['Direct', 'Numbers-first', 'No corporate filler', 'Walkthrough link inside'],
        isActive: true,
      },
    });
    console.log('✅ PositioningProfile base creado.');
  }

  // 4. Proof Stories de Autoridad verificadas
  const proofStoriesData = [
    {
      keyCode: 'META_FINTECH',
      companyOrProduct: 'Meta Fintech',
      impactMetric: 'Cutting dev cycles 25%',
      domainTags: ['Design Systems', 'Fintech', 'Enterprise UX'],
    },
    {
      keyCode: 'MESSENGER_TRUST',
      companyOrProduct: 'Meta Messenger',
      impactMetric: '+42% User Confidence',
      domainTags: ['AI UX', 'Research', 'Trust & Safety'],
    },
    {
      keyCode: 'CISCO_COMMERCE',
      companyOrProduct: 'Cisco Systems',
      impactMetric: '$40B Annual Bookings / 15k Users',
      domainTags: ['Design Systems', 'High Scale', 'Enterprise'],
    },
    {
      keyCode: 'PEPPER_AI',
      companyOrProduct: 'Pepper AI',
      impactMetric: '17,000+ Users & Seed Funding',
      domainTags: ['0-to-1 Product', 'GenAI', 'Founder'],
    },
  ];

  for (const ps of proofStoriesData) {
    const exists = await prisma.proofStory.findFirst({
      where: { positioningProfileId: profile.id, keyCode: ps.keyCode },
    });

    if (!exists) {
      await prisma.proofStory.create({
        data: {
          positioningProfileId: profile.id,
          keyCode: ps.keyCode,
          companyOrProduct: ps.companyOrProduct,
          impactMetric: ps.impactMetric,
          domainTags: ps.domainTags,
        },
      });
    }
  }
  console.log('✅ Proof Stories verificadas y ancladas al perfil.');

  console.log('🎉 Seed de estado seguro completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
