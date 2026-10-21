import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Algoritmo de clasificación de roles y fit
function classifyRole(title, desc, skills) {
  const text = `${title} ${desc} ${skills.join(' ')}`.toLowerCase();
  if (/full stack|fullstack|saas|web application|platform/i.test(title) || (/full stack/i.test(text) && /developer|engineer/i.test(text))) {
    return 'Full Stack Developer';
  }
  if (/llm|ai agent|agentic|gpt|openai|chatbot|claude|langchain|rag|prompt/i.test(text)) {
    return 'AI Agent Architect';
  }
  if (/backend|node\.js|nestjs|api|express|graphql|microservice/i.test(text)) {
    return 'Backend Engineer';
  }
  if (/ux\/ui|ui\/ux|product designer|web design|figma/i.test(title)) {
    return 'UI/UX Designer';
  }
  if (/design system|figma component|token|ui library|style guide/i.test(text)) {
    return 'Design Systems Lead';
  }
  if (/wordpress|shopify|wix|webflow|elementor/i.test(title)) {
    return 'CMS & E-commerce';
  }
  return 'Digital Specialist';
}

function evaluateJobForProfile(job, profile) {
  const skills = (job.rawApifyPayload?.skills || []);
  const normalizedRole = classifyRole(job.title, job.description, skills);
  const coreRoles = (profile.coreRoles || []).map(r => r.toLowerCase());
  const excludedRoles = (profile.excludedRoles || []).map(r => r.toLowerCase());
  const text = `${job.title} ${job.description} ${skills.join(' ')}`.toLowerCase();

  const isExcluded = excludedRoles.some(r => text.includes(r.toLowerCase()) || normalizedRole.toLowerCase().includes(r.toLowerCase()));
  const isCore = coreRoles.some(r => text.includes(r.toLowerCase()) || normalizedRole.toLowerCase().includes(r.toLowerCase()));

  let strategicLane = 'INTERFACE_BUILD';
  let skillScore = 60;
  let isCapped = false;
  let capReason = null;

  if (isExcluded) {
    strategicLane = 'DISQUALIFIED_NOISE';
    skillScore = 20;
    isCapped = true;
    capReason = 'Rol o tecnología explícitamente excluida en el perfil';
  } else if (isCore) {
    strategicLane = 'CORE_AI_UX';
    skillScore = 90;
  }

  // AI feasibility
  let aiFeasibility = 65;
  if (/social media|translation|copy/i.test(text)) aiFeasibility = 85;
  if (/ai agent|automation|n8n/i.test(text)) aiFeasibility = 80;
  if (/ux research/i.test(text)) aiFeasibility = 35;

  const clientQuality = job.isPaymentVerified ? 80 : 40;
  const recency = 85;

  let overall = Math.round(
    skillScore * 0.40 +
    aiFeasibility * 0.25 +
    clientQuality * 0.20 +
    recency * 0.15
  );

  if (isCapped) overall = Math.min(25, overall);

  let fitTier = 'LOW';
  if (overall >= 70) fitTier = 'HIGH';
  else if (overall >= 50) fitTier = 'MEDIUM';

  const suggestedStory = profile.proofStories?.[0]?.keyCode || 'DEFAULT_STORY';

  return {
    jobPostId: job.id,
    positioningProfileId: profile.id,
    status: job.status || 'NEEDS_REVIEW',
    overallScore: overall,
    fitTier,
    strategicLane,
    normalizedRole,
    skillScore,
    aiFeasibilityScore: aiFeasibility,
    clientQualityScore: clientQuality,
    recencyScore: recency,
    isCapped,
    capReason,
    summaryRationale: isExcluded
      ? `Descalificado por coincidencia con roles excluidos de ${profile.personaName}.`
      : `Evaluado para ${profile.personaName}: afinidad de rol ${strategicLane}.`,
    detectedGaps: isExcluded ? 'Exclusión de perfil' : null,
    suggestedProofStory: suggestedStory,
  };
}

async function main() {
  console.log('🔄 MIGRACIÓN A RELACIÓN MUCHOS A MUCHOS (JOB_POSTS <-> POSITIONING_PROFILES)...');

  const armando = await prisma.positioningProfile.findFirst({
    where: { personaName: { contains: 'Armando' } },
    include: { proofStories: true }
  });

  const leonardo = await prisma.positioningProfile.findFirst({
    where: { personaName: { contains: 'Leonardo' } },
    include: { proofStories: true }
  });

  if (!armando || !leonardo) {
    console.error('❌ No se encontraron los perfiles de Armando y Leonardo en DB');
    return;
  }

  console.log(`✅ Perfil Armando encontrado: ${armando.id} (${armando.personaName})`);
  console.log(`✅ Perfil Leonardo encontrado: ${leonardo.id} (${leonardo.personaName})`);

  // 1. Asignar las evaluaciones existentes sin profileId a Armando
  const updatedArmando = await prisma.fitEvaluation.updateMany({
    where: { positioningProfileId: null },
    data: { positioningProfileId: armando.id }
  });
  console.log(`📦 ${updatedArmando.count} evaluaciones existentes asignadas a Armando.`);

  // 2. Asociar propuestas existentes sin profileId a Armando
  const updatedProposals = await prisma.proposal.updateMany({
    where: { positioningProfileId: null },
    data: { positioningProfileId: armando.id }
  });
  console.log(`📦 ${updatedProposals.count} propuestas existentes asignadas a Armando.`);

  // 3. Crear evaluaciones propias para Leonardo para todas las 290 vacantes
  const allJobs = await prisma.jobPost.findMany();
  console.log(`📊 Generando evaluaciones independientes para Leonardo sobre ${allJobs.length} vacantes...`);

  let leonardoCreated = 0;
  for (const job of allJobs) {
    const evalData = evaluateJobForProfile(job, leonardo);
    await prisma.fitEvaluation.upsert({
      where: {
        uq_job_post_profile: {
          jobPostId: job.id,
          positioningProfileId: leonardo.id,
        }
      },
      create: evalData,
      update: evalData,
    });
    leonardoCreated++;
  }

  console.log(`🎉 ${leonardoCreated} evaluaciones propias generadas para Leonardo.`);

  const armandoCount = await prisma.fitEvaluation.count({ where: { positioningProfileId: armando.id } });
  const leonardoCount = await prisma.fitEvaluation.count({ where: { positioningProfileId: leonardo.id } });
  console.log(`\n✨ RESUMEN DE LA BASE MUCHOS A MUCHOS:`);
  console.log(` - Vacantes base en PostgreSQL (job_posts): ${allJobs.length}`);
  console.log(` - Evaluaciones activas para Armando: ${armandoCount}`);
  console.log(` - Evaluaciones activas para Leonardo: ${leonardoCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
