import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000001';

interface MarketTaxonomySeedNode {
  slug: string;
  name: string;
  kind: 'CATEGORY' | 'OCCUPATION';
  parentSlug?: string;
  includeTerms?: string[];
  aiLeverage?: {
    capability: string;
    task?: string;
    explanation?: string;
  };
}

const MARKET_TAXONOMY_V1: MarketTaxonomySeedNode[] = [
  { slug: 'digital-services', name: 'Digital services', kind: 'CATEGORY' as const },
  { slug: 'ux-product-design', name: 'UX & product design', kind: 'CATEGORY' as const, parentSlug: 'digital-services' },
  {
    slug: 'design-systems', name: 'Design systems', kind: 'OCCUPATION' as const, parentSlug: 'ux-product-design',
    includeTerms: ['design system', 'design tokens', 'component library', 'figma variables'],
    aiLeverage: {
      capability: 'AI-assisted design-system acceleration',
      task: 'Inventory components and map design tokens.',
      explanation: 'The taxonomy explicitly declares this bounded AI-assisted delivery capability.',
    },
  },
  { slug: 'ux-research', name: 'UX research', kind: 'OCCUPATION' as const, parentSlug: 'ux-product-design', includeTerms: ['ux research', 'user research', 'usability testing', 'user interviews', 'heuristic evaluation'] },
  { slug: 'product-ux', name: 'Product UX', kind: 'OCCUPATION' as const, parentSlug: 'ux-product-design', includeTerms: ['product ux', 'product designer', 'ux ui', 'ui ux', 'user experience'] },
  { slug: 'ai-prototyping', name: 'AI prototyping', kind: 'OCCUPATION' as const, parentSlug: 'digital-services', includeTerms: ['ai prototyping', 'ai agent', 'agentic workflow', 'llm', 'generative ai'] },
  { slug: 'workflow-automation', name: 'Workflow automation', kind: 'OCCUPATION' as const, parentSlug: 'digital-services', includeTerms: ['workflow automation', 'n8n', 'zapier', 'make com', 'power automate'] },
  { slug: 'full-stack-saas', name: 'Full-stack SaaS', kind: 'OCCUPATION' as const, parentSlug: 'digital-services', includeTerms: ['full stack', 'saas', 'web application', 'software platform'] },
  { slug: 'backend-api-engineering', name: 'Backend & API engineering', kind: 'OCCUPATION' as const, parentSlug: 'digital-services', includeTerms: ['backend', 'api', 'nestjs', 'graphql', 'microservice'] },
  { slug: 'cms-ecommerce', name: 'CMS & e-commerce', kind: 'OCCUPATION' as const, parentSlug: 'digital-services', includeTerms: ['wordpress', 'shopify', 'webflow', 'ecommerce', 'e commerce'] },
  { slug: 'social-media-content', name: 'Social media content', kind: 'OCCUPATION' as const, parentSlug: 'digital-services', includeTerms: ['social media', 'content creation', 'instagram', 'tiktok', 'reels'] },
];

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
        searchKeywords: ['UI/UX Designer', 'UX/UI Design', 'UX Research', 'Design Systems', 'AI Product Design', 'Figma', 'Usability Testing', 'AI Prototyping'],
        minBudgetFixed: 1000.00,
        minHourlyRate: 40.00,
        recencyDays: 30,
        verifiedPaymentOnly: true,
      },
    });
    console.log('✅ ScrapeConfig base creado.');
  }

  // The catalog is shared, versioned reference data. Profile-specific choices
  // are stored separately in ProfileCategoryPolicy and are never overwritten here.
  const taxonomyIdsBySlug = new Map<string, string>();
  for (const node of MARKET_TAXONOMY_V1) {
    const parentId = node.parentSlug ? taxonomyIdsBySlug.get(node.parentSlug) : null;
    if (node.parentSlug && !parentId) {
      throw new Error(`Taxonomy parent ${node.parentSlug} must be seeded before ${node.slug}.`);
    }

    const taxonomyNode = await prisma.marketTaxonomyNode.upsert({
      where: { slug: node.slug },
      update: {
        source: 'CUSTOM',
        name: node.name,
        kind: node.kind,
        parentId,
        taxonomyVersion: 1,
        metadata: { seed: 'market-taxonomy-v1', classification: { includeTerms: node.includeTerms || [] }, ...(node.aiLeverage ? { aiLeverage: node.aiLeverage } : {}) },
        isActive: true,
      },
      create: {
        source: 'CUSTOM',
        slug: node.slug,
        name: node.name,
        kind: node.kind,
        parentId,
        taxonomyVersion: 1,
        metadata: { seed: 'market-taxonomy-v1', classification: { includeTerms: node.includeTerms || [] }, ...(node.aiLeverage ? { aiLeverage: node.aiLeverage } : {}) },
      },
    });

    taxonomyIdsBySlug.set(node.slug, taxonomyNode.id);
  }
  console.log('✅ Market taxonomy v1 seeded.');

  // El catálogo se materializa una sola vez. Así no reaparece un perfil que el
  // usuario haya eliminado después de la inicialización inicial.
  if (tenant.profileCatalogVersion === 0) {
  const hadExistingProfiles = (await prisma.positioningProfile.count({ where: { tenantId: tenant.id } })) > 0;
  // 3. Perfil de Posicionamiento base (Armando: Senior AI UX Designer)
  let profile = await prisma.positioningProfile.findFirst({
    where: { tenantId: tenant.id, personaName: 'Armando: Senior AI UX Designer' },
  });

  if (!profile) {
    profile = await prisma.positioningProfile.create({
      data: {
        tenantId: tenant.id,
        personaName: 'Armando: Senior AI UX Designer',
        roleTitle: 'AI Interaction & Agentic UX Designer',
        offerHeadline: 'AI-native UX for product teams: senior design-system, prototyping, and research work delivered at agency speed by pairing 10+ years of Meta/Google/Cisco design craft with AI-assisted workflows.',
        targetAudience: 'Seed-to-Series B SaaS founders and product leads who need senior design-system or UX-research work fast, but cannot yet justify a full-time senior hire.',
        voiceRules: ['Direct', 'Numbers-first', 'No corporate filler', 'Walkthrough link inside'],
        searchKeywords: ['UI/UX design', 'UX/UI designer', 'UX research', 'design system', 'Figma design system', 'AI product design', 'usability testing', 'AI prototyping', 'vibe coding', 'agentic workflow design', 'N8N automation design', 'GenAI UX'],
        minBudgetFixed: 1000.00,
        minHourlyRate: 40.00,
        targetCountries: ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'Ireland'],
        targetRegions: ['North America', 'Western Europe'],
        isActive: !hadExistingProfiles,
      },
    });
    console.log('✅ PositioningProfile base de Armando creado.');
  }

  // 4. Proof Stories de Autoridad verificadas
  const proofStoriesData = [
    {
      keyCode: 'META_FINTECH',
      companyOrProduct: 'Meta Fintech',
      impactMetric: 'Cutting dev cycles 25%',
      description: 'Standardized UX patterns across three Meta Fintech engineering teams, cutting design-related development cycles by 25%.',
      domainTags: ['Design Systems', 'Fintech', 'Enterprise UX'],
    },
    {
      keyCode: 'MESSENGER_TRUST',
      companyOrProduct: 'Meta Messenger',
      impactMetric: '+42% User Confidence',
      description: 'Ran AI-trust research for Messenger privacy and moderation features, increasing confidence in AI interactions by 42%.',
      domainTags: ['AI UX', 'Research', 'Trust & Safety'],
    },
    {
      keyCode: 'CISCO_COMMERCE',
      companyOrProduct: 'Cisco Systems',
      impactMetric: '$40B Annual Bookings / 15k Users',
      description: 'Built the UI pattern library behind Cisco Commerce Workspace for 15,000 users and $40B in annual bookings.',
      domainTags: ['Design Systems', 'High Scale', 'Enterprise'],
    },
    {
      keyCode: 'PEPPER_AI',
      companyOrProduct: 'Pepper AI',
      impactMetric: '17,000+ Users & Seed Funding',
      description: 'Founded an AI entertainment assistant that reached 17,000 users and secured seed funding.',
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
          description: ps.description,
          domainTags: ps.domainTags,
        },
      });
    } else if (!exists.description) {
      await prisma.proofStory.update({
        where: { id: exists.id },
        data: { description: ps.description },
      });
    }
  }
  console.log('✅ Proof Stories verificadas y ancladas al perfil.');

  const leonardo = await prisma.positioningProfile.findFirst({
    where: { tenantId: tenant.id, personaName: 'Leonardo Jaimes: Senior Full Stack & AI Architect' },
  });

  if (!leonardo) {
    await prisma.positioningProfile.create({
      data: {
        tenantId: tenant.id,
        personaName: 'Leonardo Jaimes: Senior Full Stack & AI Architect',
        roleTitle: 'Senior Full Stack Developer & AI Systems Architect',
        offerHeadline: 'I build AI-driven multi-tenant SaaS platforms that automate content generation, decision-making, and publishing, reducing production time by over 80% and ensuring brand consistency for your business.',
        targetAudience: 'Founders, CTOs, and technical leaders of fast-growing SaaS startups, digital agencies, and media companies seeking to leverage AI for content automation and scalable web/mobile solutions.',
        voiceRules: ['Direct', 'Numbers-first', 'No corporate filler'],
        searchKeywords: ['Full Stack Developer', 'Backend Engineer', 'Node.js Developer', 'NestJS', 'Vue.js', 'Nuxt.js', 'AI Agent Architect', 'Automation Engineer', 'SaaS Platform'],
        minBudgetFixed: 1000.00,
        minHourlyRate: 50.00,
        targetCountries: ['United States', 'United Kingdom', 'Canada', 'Australia'],
        targetRegions: ['North America', 'Western Europe'],
        coreRoles: ['Full Stack Developer', 'Backend Engineer', 'Node.js Developer', 'Vue.js Developer', 'Nuxt.js Developer', 'MongoDB Developer', 'NestJS Developer'],
        hybridRoles: ['AI Agent Architect', 'Automation Engineer', 'Multi-Tenant SaaS Architect', 'Prompt Engineer', 'Spec-Driven Developer', 'Workflow Orchestration Specialist'],
        tangentialRoles: ['Frontend Lead', 'Mobile Developer (Flutter)', 'REST API Designer', 'Technical Lead'],
        excludedRoles: ['UI/UX Designer', 'Graphic Designer', 'Manual QA Tester', 'Data Entry Specialist', 'Virtual Assistant', 'Telemarketing', 'WordPress Developer', 'Shopify Developer'],
        isActive: false,
      },
    });
    console.log('✅ PositioningProfile de Leonardo creado.');
  }

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { profileCatalogVersion: 1 },
    });
    console.log('✅ Catálogo de perfiles inicializado.');
  } else {
    console.log('ℹ️ Catálogo de perfiles ya inicializado; se preservan cambios del usuario.');
  }

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
