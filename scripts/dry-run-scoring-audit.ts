import { FitCalculatorService } from '../backend/src/modules/scoring/services/fit-calculator.service';
import { RoleClassifierService } from '../backend/src/modules/scoring/services/role-classifier.service';

async function runDryRun() {
  console.log('🔍 Iniciando Auditoría Dry-Run en Producción (Cero Escritura en BD)...\n');

  const roleClassifier = new RoleClassifierService();
  const fitCalculator = new FitCalculatorService(roleClassifier);

  const res = await fetch('https://pepper-tix-proposal-backend.zh4nwb.easypanel.host/api/scraping/jobs');
  if (!res.ok) {
    throw new Error(`Error HTTP consultando API de producción: ${res.status}`);
  }

  const jobs: any[] = await res.json();
  console.log(`📦 Descargados ${jobs.length} empleos reales de EasyPanel.\n`);

  interface AuditRecord {
    title: string;
    oldScore: number;
    newScore: number;
    delta: number;
    oldTier: string;
    newTier: string;
    lane: string;
    eligibility: string;
    quality: string;
    isCapped: boolean;
    capReason: string | null;
  }

  const results: AuditRecord[] = [];

  for (const job of jobs) {
    const raw = job.rawApifyPayload || {};
    
    // Parseo defensivo idéntico al nuevo ApifyJobAdapter
    let proposalsCount: number | null = null;
    if (raw.client_activity?.totalApplicants != null) {
      proposalsCount = Number(raw.client_activity.totalApplicants);
    } else if (raw.proposals?.count != null) {
      proposalsCount = Number(raw.proposals.count);
    }

    let postedAt: Date | null = null;
    if (raw.publish_time) {
      postedAt = new Date(raw.publish_time);
    } else if (raw.postedDate) {
      postedAt = new Date(raw.postedDate);
    }

    let clientCountry: string | null = job.clientCountry || raw.buyer?.location?.country || raw.client?.country || null;
    if (!clientCountry && raw.nation) {
      clientCountry = String(raw.nation).split('/')[0].trim();
    }
    if (clientCountry) {
      const lower = clientCountry.toLowerCase().trim();
      if (lower === 'us' || lower === 'usa' || lower.includes('united states')) {
        clientCountry = 'United States';
      }
    }

    const skills: string[] = [];
    if (Array.isArray(raw.ontologySkills)) {
      skills.push(...raw.ontologySkills.map((s: any) => s.prefLabel || s.name || String(s)));
    } else if (Array.isArray(raw.skills)) {
      skills.push(...raw.skills.map((s: any) => String(s)));
    }

    const newEval = fitCalculator.calculate({
      title: job.title,
      description: job.description || '',
      skills,
      clientTotalSpend: Number(job.clientTotalSpend || 0),
      clientRating: Number(job.clientRating || 0),
      clientCountry: clientCountry || undefined,
      proposalsCount: proposalsCount != null ? proposalsCount : undefined,
      isPaymentVerified: job.isPaymentVerified,
      postedDate: postedAt || undefined,
      targetCountries: ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'Ireland'],
      geoFilterMode: 'WEIGHTED_PREFERENCE',
    });

    const oldScore = job.fitEvaluation?.overallScore ?? 0;
    const oldTier = job.fitEvaluation?.fitTier ?? 'UNKNOWN';

    results.push({
      title: job.title.slice(0, 48),
      oldScore,
      newScore: newEval.overallScore,
      delta: newEval.overallScore - oldScore,
      oldTier,
      newTier: newEval.fitTier,
      lane: newEval.strategicLane,
      eligibility: newEval.eligibilityStatus,
      quality: newEval.dataQualityStatus,
      isCapped: newEval.isCapped,
      capReason: newEval.capReason,
    });
  }

  // Ordenar por nuevo Score descendente
  results.sort((a, b) => b.newScore - a.newScore);

  console.log('='.repeat(115));
  console.log(
    'TÍTULO (Truncado a 48 car)'.padEnd(50) +
    'OLD'.padStart(5) +
    'NEW'.padStart(5) +
    'Δ'.padStart(5) +
    'TIER OLD -> NEW'.padStart(18) +
    'ESTADO'.padStart(12) +
    'CAP / RAZÓN'.padStart(20)
  );
  console.log('='.repeat(115));

  for (const r of results) {
    const deltaStr = (r.delta > 0 ? `+${r.delta}` : `${r.delta}`);
    const tierStr = `${r.oldTier} -> ${r.newTier}`;
    const capStr = r.isCapped ? `[CAP: ${r.newScore}]` : 'OK';
    console.log(
      r.title.padEnd(50) +
      String(r.oldScore).padStart(5) +
      String(r.newScore).padStart(5) +
      deltaStr.padStart(5) +
      tierStr.padStart(18) +
      r.eligibility.padStart(12) +
      capStr.padStart(20)
    );
  }
  console.log('='.repeat(115));

  console.log('\n📊 RESUMEN DE LA AUDITORÍA DRY-RUN:');
  const highFitNew = results.filter(r => r.newTier === 'HIGH').length;
  const medFitNew = results.filter(r => r.newTier === 'MEDIUM').length;
  const lowFitNew = results.filter(r => r.newTier === 'LOW').length;
  const cappedCount = results.filter(r => r.isCapped).length;

  console.log(`- Total vacantes auditadas: ${results.length}`);
  console.log(`- Nuevos HIGH FIT (Oro real): ${highFitNew}`);
  console.log(`- Nuevos MEDIUM FIT (Revisión secundaria): ${medFitNew}`);
  console.log(`- Nuevos LOW FIT (Descarte / Ruido filtrado): ${lowFitNew}`);
  console.log(`- Vacantes frenadas por Safety Caps: ${cappedCount}`);

  // Casos de Control Críticos
  const realEstateJob = results.find(r => r.title.toLowerCase().includes('real estate acquisition'));
  if (realEstateJob) {
    console.log(`\n🎯 CONTROL ADV-1: "Real Estate Acquisition Manager"`);
    console.log(`   Score Anterior: ${realEstateJob.oldScore} (${realEstateJob.oldTier})`);
    console.log(`   Score Nuevo:    ${realEstateJob.newScore} (${realEstateJob.newTier}) | Estado: ${realEstateJob.eligibility}`);
    console.log(`   Veredicto:      ${realEstateJob.newScore <= 44 ? '✅ CORREGIDO (Cayó a LOW FIT)' : '❌ ERROR'}`);
  }

  const quickbooksJob = results.find(r => r.title.toLowerCase().includes('quickbooks'));
  if (quickbooksJob) {
    console.log(`\n🎯 CONTROL ADV-4: "QuickBooks Construction Bookkeeping"`);
    console.log(`   Score Anterior: ${quickbooksJob.oldScore} (${quickbooksJob.oldTier})`);
    console.log(`   Score Nuevo:    ${quickbooksJob.newScore} (${quickbooksJob.newTier}) | Estado: ${quickbooksJob.eligibility}`);
    console.log(`   Veredicto:      ${quickbooksJob.newScore <= 44 ? '✅ CORREGIDO (Cayó a LOW FIT)' : '❌ ERROR'}`);
  }
}

runDryRun().catch(err => {
  console.error('Error ejecutando dry-run:', err);
  process.exit(1);
});
