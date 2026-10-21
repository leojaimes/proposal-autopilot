import { PrismaClient } from '../backend/node_modules/@prisma/client/index.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@localhost:5438/proposal_autopilot_db?schema=public'
    }
  }
});

// Helper para calcular la mediana
function median(values) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Categorizador temático de vacantes de Upwork
function categorizeJob(title, desc, skills) {
  const text = `${title} ${desc} ${(skills || []).join(' ')}`.toLowerCase();

  if (/social media|content creation|instagram|tiktok|video edit|carousel|reels|youtube/i.test(title)) {
    return 'Social media content';
  }
  if (/design system|figma component|token|ui library|style guide/i.test(text) && /design|figma/i.test(title)) {
    return 'Design systems';
  }
  if (/ux research|user testing|usability test|user interview|heuristic/i.test(text)) {
    return 'UX research';
  }
  if (/full stack|fullstack|saas|web application|platform/i.test(title) || (/full stack/i.test(text) && /developer|engineer/i.test(text))) {
    return 'Full Stack & SaaS Web Apps';
  }
  if (/llm|ai agent|agentic|gpt|openai|chatbot|claude|langchain|rag|prompt/i.test(text)) {
    return 'AI prototyping / AI Agents';
  }
  if (/n8n|zapier|make\.com|workflow automation|automation engineer|power automate/i.test(text)) {
    return 'n8n / workflow automation';
  }
  if (/gohighlevel|ghl|crm setup|funnel/i.test(text)) {
    return 'GoHighLevel setup';
  }
  if (/ux\/ui|ui\/ux|product designer|web design|figma/i.test(title)) {
    return 'UX/UI design';
  }
  if (/translat|english to spanish|spanish to english|bilingual/i.test(text)) {
    return 'Spanish/English translation';
  }
  if (/seo|aeo|geo|search optimization|ai search/i.test(text)) {
    return 'AEO / GEO (AI search)';
  }
  if (/backend|node\.js|nestjs|api|express|graphql|microservice/i.test(title)) {
    return 'Backend & API Engineering';
  }
  if (/mobile|flutter|react native|ios|android/i.test(title)) {
    return 'Mobile App Development';
  }
  if (/wordpress|shopify|wix|webflow|elementor/i.test(title)) {
    return 'CMS & E-commerce (WP/Shopify)';
  }
  return 'Other Tech / Digital Work';
}

async function main() {
  console.log('📊 Extrayendo 290 vacantes de PostgreSQL para construir la Matriz de Oportunidad...');
  const jobs = await prisma.jobPost.findMany();
  console.log(`Total vacantes analizadas: ${jobs.length}`);

  // Obtener perfil activo de Leonardo para calcular afinidad técnica
  const profile = await prisma.positioningProfile.findFirst({
    where: { isActive: true },
    include: { proofStories: true }
  });

  // Agrupar vacantes por Categoría
  const groups = {};

  for (const job of jobs) {
    const cat = categorizeJob(job.title, job.description, job.skills);
    if (!groups[cat]) {
      groups[cat] = {
        category: cat,
        jobs: [],
      };
    }
    groups[cat].jobs.push(job);
  }

  // Encontrar rango temporal para New jobs per hour
  const validDates = jobs.map(j => j.postedAt ? new Date(j.postedAt).getTime() : null).filter(Boolean);
  const minTime = validDates.length > 0 ? Math.min(...validDates) : Date.now() - (24 * 3600 * 1000);
  const maxTime = validDates.length > 0 ? Math.max(...validDates) : Date.now();
  const totalHours = Math.max(1, (maxTime - minTime) / (1000 * 3600));

  // Matriz de facilidad de IA estimada (AI Ease) por categoría
  const aiEaseMap = {
    'Social media content': 85,
    'Spanish/English translation': 85,
    'AI prototyping / AI Agents': 80,
    'n8n / workflow automation': 75,
    'GoHighLevel setup': 75,
    'AEO / GEO (AI search)': 70,
    'Full Stack & SaaS Web Apps': 70,
    'Backend & API Engineering': 65,
    'UX/UI design': 60,
    'Design systems': 55,
    'Mobile App Development': 50,
    'CMS & E-commerce (WP/Shopify)': 65,
    'UX research': 35,
    'Other Tech / Digital Work': 50,
  };

  // Mapeo de Lane para el perfil de Leonardo (Full Stack & AI Architect)
  const laneMap = {
    'Full Stack & SaaS Web Apps': 'Core',
    'Backend & API Engineering': 'Core',
    'AI prototyping / AI Agents': 'Core',
    'n8n / workflow automation': 'Adjacent',
    'UX/UI design': 'Adjacent',
    'Design systems': 'Adjacent',
    'Mobile App Development': 'Adjacent',
    'Social media content': 'Adjacent',
    'AEO / GEO (AI search)': 'Adjacent',
    'GoHighLevel setup': 'Adjacent',
    'Spanish/English translation': 'Adjacent',
    'UX research': 'Adjacent',
    'CMS & E-commerce (WP/Shopify)': 'Excluded',
    'Other Tech / Digital Work': 'Adjacent',
  };

  // Skill affinity para el perfil de Leonardo
  const skillAffinityMap = {
    'Full Stack & SaaS Web Apps': 95,
    'Backend & API Engineering': 90,
    'AI prototyping / AI Agents': 85,
    'n8n / workflow automation': 75,
    'UX/UI design': 65,
    'Design systems': 60,
    'Mobile App Development': 70,
    'Social media content': 60,
    'AEO / GEO (AI search)': 55,
    'GoHighLevel setup': 50,
    'Spanish/English translation': 65,
    'UX research': 40,
    'CMS & E-commerce (WP/Shopify)': 15,
    'Other Tech / Digital Work': 50,
  };

  const rows = [];

  for (const cat of Object.keys(groups)) {
    const list = groups[cat].jobs;
    const sampled = list.length;
    if (sampled < 3) continue; // Descartar categorías sin muestra representativa

    const lane = laneMap[cat] || 'Adjacent';
    const skillAffinity = skillAffinityMap[cat] || 60;
    const aiEase = aiEaseMap[cat] || 60;

    // Métricas de Scraping
    const newJobsPerHour = +(sampled / totalHours).toFixed(2);

    const proposals = list.map(j => j.proposalsCount || 0);
    const medianProposals = Math.round(median(proposals));

    const under10Count = list.filter(j => (j.proposalsCount || 0) < 10).length;
    const pctUnder10 = Math.round((under10Count / sampled) * 100);

    const hourlyRates = list.map(j => j.hourlyRate ? Number(j.hourlyRate) : null).filter(r => r !== null && r > 0);
    const medianHourly = hourlyRates.length > 0 ? Math.round(median(hourlyRates)) : 25;

    const fixedBudgets = list.map(j => j.budgetFixed ? Number(j.budgetFixed) : null).filter(b => b !== null && b > 0);
    const medianFixed = fixedBudgets.length > 0 ? Math.round(median(fixedBudgets)) : 200;

    const verifiedCount = list.filter(j => j.clientPaymentVerified).length;
    const pctVerified = Math.round((verifiedCount / sampled) * 100);

    // Personal Fit = (Skill * 0.6) + (AI Ease * 0.4)
    const personalFit = Math.round((skillAffinity * 0.6) + (aiEase * 0.4));

    // Market Score = F(Demand, Low Competition, Pay, Verified)
    // Escala 0 a 100
    // Demanda: más jobs/hr -> más puntos (hasta 30 pts)
    const demandScore = Math.min(30, Math.round(newJobsPerHour * 10));
    // Baja competencia: % under 10 proposals (hasta 35 pts)
    const compScore = Math.round((pctUnder10 / 100) * 35);
    // Pago: median hourly / 50 (hasta 20 pts)
    const payScore = Math.min(20, Math.round((medianHourly / 50) * 20));
    // Verified: % verified * 15 pts (hasta 15 pts)
    const verifiedScore = Math.round((pctVerified / 100) * 15);
    const marketScore = Math.min(99, Math.max(15, demandScore + compScore + payScore + verifiedScore));

    // Overall Opportunity = (Market Score * 0.5) + (Personal Fit * 0.5)
    // Si la categoría está Excluida, se penaliza drásticamente
    let overallOpp = Math.round((marketScore * 0.5) + (personalFit * 0.5));
    if (lane === 'Excluded') {
      overallOpp = Math.min(25, overallOpp);
    }

    rows.push({
      Category: cat,
      Lane: lane,
      'Overall opportunity': overallOpp,
      'Market score (demand, low competition, pay)': marketScore,
      'Personal fit (skills + AI ease)': personalFit,
      'New jobs per hour': newJobsPerHour,
      'Median proposals already in': medianProposals,
      '% jobs under 10 proposals': pctUnder10,
      'Median hourly (USD)': medianHourly,
      'Median fixed (USD)': medianFixed,
      '% verified clients': pctVerified,
      'Skill affinity': skillAffinity,
      'AI ease': aiEase,
      'Relevant jobs sampled': sampled,
      'Runs averaged': 1,
      Updated: new Date().toISOString().split('T')[0]
    });
  }

  // Ordenar por Overall Opportunity DESC
  rows.sort((a, b) => b['Overall opportunity'] - a['Overall opportunity']);

  // Asignar Ranks
  const finalTable = rows.map((r, idx) => ({
    Rank: idx + 1,
    ...r
  }));

  console.log('\n========================================================================================');
  console.log('🏆 MATRIZ DE OPORTUNIDAD DE MERCADO (ESTRATEGIA ARBITRAJE UPWORK)');
  console.log('   Perfil: Leonardo Jaimes Estevez (Senior Full Stack & AI Architect)');
  console.log('   Muestra Real: 290 vacantes scrapeadas de Upwork');
  console.log('========================================================================================\n');
  console.table(finalTable);

  return finalTable;
}

main().catch(console.error).finally(() => prisma.$disconnect());
