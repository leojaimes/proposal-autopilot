import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const targetEmail = process.argv[2] || 'leo.jaimes.estevez@gmail.com';

  console.log(`\n🔍 Buscando usuario: ${targetEmail}...`);

  const user = await prisma.tenantUser.findUnique({
    where: { email: targetEmail },
    include: { tenant: true },
  });

  if (!user) {
    console.log(`❌ No se encontró ningún usuario con el correo: ${targetEmail}`);
    return;
  }

  const tenantId = user.tenantId;
  console.log(`✅ Usuario encontrado: ID ${user.id} | Rol: ${user.role}`);
  console.log(`🏢 Tenant asociado: ID ${tenantId} | Nombre: "${user.tenant.name}" | Slug: "${user.tenant.slug}"`);

  // Contar registros que se van a eliminar
  const [
    jobsCount,
    batchesCount,
    profilesCount,
    scrapeConfigsCount,
    decisionsCount,
    snapshotsCount,
    oppSnapshotsCount,
    policiesCount,
    workCount,
  ] = await Promise.all([
    prisma.jobPost.count({ where: { tenantId } }),
    prisma.batchRun.count({ where: { tenantId } }),
    prisma.positioningProfile.count({ where: { tenantId } }),
    prisma.scrapeConfig.count({ where: { tenantId } }),
    prisma.marketRadarDecision.count({ where: { tenantId } }),
    prisma.marketCategorySnapshot.count({ where: { tenantId } }),
    prisma.profileOpportunitySnapshot.count({ where: { tenantId } }),
    prisma.profileCategoryPolicy.count({ where: { tenantId } }),
    prisma.taxonomyClassificationWork.count({ where: { tenantId } }),
  ]);

  console.log('\n📊 Registros vinculados al Tenant que serán eliminados:');
  console.log(`   - Vacantes (JobPosts): ${jobsCount}`);
  console.log(`   - Lotes de Scraping (BatchRuns): ${batchesCount}`);
  console.log(`   - Perfiles de Posicionamiento: ${profilesCount}`);
  console.log(`   - Configs de Scrape: ${scrapeConfigsCount}`);
  console.log(`   - Decisiones Radar: ${decisionsCount}`);
  console.log(`   - Snapshots Categorías: ${snapshotsCount}`);
  console.log(`   - Snapshots Oportunidades: ${oppSnapshotsCount}`);
  console.log(`   - Políticas Categorías: ${policiesCount}`);
  console.log(`   - Trabajos Taxonomía: ${workCount}`);

  console.log(`\n🗑️  Eliminando Tenant ${tenantId} en Cascada (elimina usuario, perfiles, historias, credenciales, vacantes)...`);

  await prisma.tenant.delete({
    where: { id: tenantId },
  });

  console.log(`\n🎉 [ÉXITO]: El usuario "${targetEmail}" y todo su Tenant con todas sus dependencias han sido eliminados por completo.`);
}

main()
  .catch((e) => {
    console.error('❌ Error al eliminar usuario:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

