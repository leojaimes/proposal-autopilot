import { PrismaClient } from '../backend/node_modules/@prisma/client/index.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@localhost:5438/proposal_autopilot_db?schema=public'
    }
  }
});

async function main() {
  console.log('🔄 Checking existing positioning profiles and proof stories...');
  
  const profiles = await prisma.positioningProfile.findMany({
    include: { proofStories: true }
  });
  
  console.log(`Found ${profiles.length} positioning profile(s).`);
  for (const p of profiles) {
    console.log(`- Profile [${p.id}]: "${p.offerHeadline}" (Stories: ${p.proofStories.length})`);
  }

  // Borrar todas las proof stories existentes para dejarlo limpio de Leonardo
  const deletedStories = await prisma.proofStory.deleteMany({});
  console.log(`🗑️ Deleted ${deletedStories.count} proof stories.`);

  // Resetear el perfil del tenant default a un estado limpio / cero
  const updatedProfiles = await prisma.positioningProfile.updateMany({
    data: {
      offerHeadline: 'Perfil por calibrar',
      targetAudience: 'Pendiente de calibración',
      voiceRules: [],
      coreRoles: [],
      hybridRoles: [],
      tangentialRoles: [],
      excludedRoles: [],
      isActive: true
    }
  });
  console.log(`🧹 Reset ${updatedProfiles.count} positioning profile(s) to blank state.`);

  // Resetear scraping config a default
  await prisma.scrapeConfig.updateMany({
    data: {
      searchKeywords: [],
      minHourlyRate: 40.0,
      minBudgetFixed: 500.0,
      targetCountries: [],
      excludedCountries: []
    }
  });
  console.log(`🧹 Reset scrape configurations.`);

  console.log('✅ Base de datos limpia y lista para la prueba de ingesta de Leonardo.');
}

main()
  .catch((err) => {
    console.error('❌ Error resetting profile:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
