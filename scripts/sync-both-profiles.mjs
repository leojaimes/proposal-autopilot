import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Sincronizando perfiles independientes de Armando y Leonardo en PostgreSQL...');

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('❌ No se encontró ningún Tenant');
    return;
  }

  const tenantId = tenant.id;

  // 1. Perfil Armando
  const armandoName = 'Armando: Senior AI UX Designer';
  let armando = await prisma.positioningProfile.findFirst({
    where: { tenantId, personaName: armandoName }
  });

  const armandoData = {
    tenantId,
    personaName: armandoName,
    offerHeadline: 'AI-native UX for product teams: senior design-system, prototyping, and research work delivered at agency speed by pairing 10+ years of Meta/Google/Cisco design craft with AI-assisted workflows.',
    targetAudience: 'Seed-to-Series B SaaS founders and product leads who need senior design-system or UX-research work fast, but cannot yet justify a full-time senior hire.',
    voiceRules: ['First person peer-to-peer', 'No em dashes anywhere', 'Sell result before tool'],
    coreRoles: ['UI/UX design', 'UX research', 'design system', 'usability testing'],
    hybridRoles: ['AI product design', 'agentic workflow design', 'AI prototyping', 'n8n / workflow automation'],
    tangentialRoles: ['Product manager', 'Web designer', 'Graphic designer'],
    excludedRoles: ['Full Stack', 'Backend', 'React Developer', 'Software Engineer', 'Assistant', 'Telemarketing', 'WordPress Developer', 'Shopify Developer'],
    isActive: true, // Por defecto activo para restaurar Armando
  };

  if (!armando) {
    armando = await prisma.positioningProfile.create({ data: armandoData });
    console.log('✅ Perfil Armando creado en DB');
  } else {
    armando = await prisma.positioningProfile.update({
      where: { id: armando.id },
      data: armandoData,
    });
    console.log('✅ Perfil Armando actualizado en DB');
  }

  // Sincronizar historias de Armando
  await prisma.proofStory.deleteMany({ where: { positioningProfileId: armando.id } });
  await prisma.proofStory.createMany({
    data: [
      {
        positioningProfileId: armando.id,
        keyCode: 'META_FINTECH',
        companyOrProduct: 'Meta Fintech',
        impactMetric: 'Cutting dev cycles 25%',
        domainTags: ['Design Systems', 'Fintech', 'Enterprise UX'],
      },
      {
        positioningProfileId: armando.id,
        keyCode: 'MESSENGER_TRUST',
        companyOrProduct: 'Meta Messenger',
        impactMetric: '+42% User Confidence',
        domainTags: ['AI UX', 'Research', 'Trust & Safety'],
      },
      {
        positioningProfileId: armando.id,
        keyCode: 'CISCO_COMMERCE',
        companyOrProduct: 'Cisco Systems',
        impactMetric: '$40B Annual Bookings / 15k Users',
        domainTags: ['Design Systems', 'High Scale', 'Enterprise'],
      },
      {
        positioningProfileId: armando.id,
        keyCode: 'PEPPER_AI',
        companyOrProduct: 'Pepper AI',
        impactMetric: '17,000+ Users & Seed Funding',
        domainTags: ['0-to-1 Product', 'GenAI', 'Founder'],
      },
    ],
  });

  // 2. Perfil Leonardo Jaimes
  const leonardoName = 'Leonardo Jaimes: Senior Full Stack & AI Architect';
  let leonardo = await prisma.positioningProfile.findFirst({
    where: { 
      tenantId,
      OR: [
        { personaName: leonardoName },
        { personaName: 'Consultor' },
      ]
    }
  });

  const leonardoData = {
    tenantId,
    personaName: leonardoName,
    offerHeadline: 'I build AI-driven multi-tenant SaaS platforms that automate content generation, decision-making, and publishing, reducing production time by over 80% and ensuring brand consistency for your business.',
    targetAudience: 'Founders, CTOs, and technical leaders of fast-growing SaaS startups, digital agencies, and media companies seeking to leverage AI for content automation and scalable web/mobile solutions.',
    voiceRules: ['First person peer-to-peer', 'No em dashes anywhere', 'Sell result before tool'],
    coreRoles: [
      'Full Stack Developer',
      'Backend Engineer',
      'Node.js Developer',
      'Vue.js Developer',
      'Nuxt.js Developer',
      'MongoDB Developer',
      'NestJS Developer'
    ],
    hybridRoles: [
      'AI Agent Architect',
      'Automation Engineer',
      'Multi-Tenant SaaS Architect',
      'Prompt Engineer',
      'Spec-Driven Developer',
      'Workflow Orchestration Specialist'
    ],
    tangentialRoles: [
      'Frontend Lead',
      'Mobile Developer (Flutter)',
      'REST API Designer',
      'Technical Lead'
    ],
    excludedRoles: [
      'UI/UX Designer',
      'Graphic Designer',
      'Manual QA Tester',
      'Data Entry Specialist',
      'Virtual Assistant',
      'Telemarketing',
      'WordPress Developer',
      'Shopify Developer'
    ],
    isActive: false, // Inactivo mientras Armando esté activo
  };

  if (!leonardo) {
    leonardo = await prisma.positioningProfile.create({ data: leonardoData });
    console.log('✅ Perfil Leonardo creado en DB');
  } else {
    leonardo = await prisma.positioningProfile.update({
      where: { id: leonardo.id },
      data: leonardoData,
    });
    console.log('✅ Perfil Leonardo actualizado en DB');
  }

  // Sincronizar historias de Leonardo
  await prisma.proofStory.deleteMany({ where: { positioningProfileId: leonardo.id } });
  await prisma.proofStory.createMany({
    data: [
      {
        positioningProfileId: leonardo.id,
        keyCode: 'SPOTLIGHT_AI_PLATFORM',
        companyOrProduct: 'AI Publications Platform (SaaS)',
        impactMetric: '80% Reduction in Content Production Time',
        domainTags: ['AI Agent Design', 'Multi-Tenant SaaS', 'Content Automation', 'Vue/Nuxt', 'Node.js/NestJS'],
      },
      {
        positioningProfileId: leonardo.id,
        keyCode: 'PEPPERTIX_WEB',
        companyOrProduct: 'PepperTix Web Application',
        impactMetric: 'Increased User Engagement (Improved SEO & Accessibility)',
        domainTags: ['Frontend Development', 'Vue/Nuxt.js', 'Responsive Design', 'SEO Optimization'],
      },
      {
        positioningProfileId: leonardo.id,
        keyCode: 'PEPPERTIX_BACKEND',
        companyOrProduct: 'PepperTix Backend',
        impactMetric: 'Ensured Database Integration & Data Consistency',
        domainTags: ['Backend Development', 'Node.js/Express.js', 'RESTful APIs', 'MongoDB'],
      },
      {
        positioningProfileId: leonardo.id,
        keyCode: 'PEPPER_VIDEOS_MOBILE',
        companyOrProduct: 'Pepper Videos Mobile',
        impactMetric: 'Scalable, Testable, and Maintainable Mobile App',
        domainTags: ['Mobile Development', 'Flutter', 'Clean Architecture', 'Video Search'],
      },
      {
        positioningProfileId: leonardo.id,
        keyCode: 'PEPPER_BOT',
        companyOrProduct: 'Pepper Bot',
        impactMetric: 'Conversational Event Search Functionality',
        domainTags: ['Chatbot Development', 'Dialogflow', 'ChatGPT', 'Facebook Messenger'],
      },
    ],
  });

  const allProfiles = await prisma.positioningProfile.findMany({
    include: { proofStories: true }
  });
  console.log(`\n🎉 Ambos perfiles configurados limpiamente en PostgreSQL:`);
  allProfiles.forEach(p => {
    console.log(` - [${p.isActive ? 'ACTIVO' : 'INACTIVO'}] ${p.personaName} (${p.coreRoles.length} core, ${p.proofStories.length} stories)`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
