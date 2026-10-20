import test, { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { RoleClassifierService } from './role-classifier.service';
import { FitCalculatorService, FitCalculationInput } from './fit-calculator.service';
import { StrategicLane } from '../constants/taxonomy.constants';

describe('Adversarial & Edge-Case Scoring Engine Suite - Deductive Model', () => {
  const roleClassifier = new RoleClassifierService();
  const fitCalculator = new FitCalculatorService(roleClassifier);

  // Queries activas de calibración del usuario (las 10 de la pantalla del Calibrador)
  const userActiveQueries = [
    'UX research',
    'design system',
    'Figma design system',
    'AI product design',
    'usability testing',
    'AI prototyping',
    'vibe coding',
    'agentic workflow design',
  ];

  // ADV-1: El Asistente de Búsqueda de Empleo (El caso real detectado hoy)
  it('ADV-1: Debe penalizar severamente "Job Application Assistant" como rol incompatible (<= 25 pts)', () => {
    const input: FitCalculationInput = {
      title: 'Job Application Assistant for Technical Product Manager (TPM)',
      description: 'Looking for a detail-oriented Job Application Assistant (Reverse Recruiter) to apply to tech roles on my behalf.',
      activeQueries: userActiveQueries,
      clientCountry: 'United States',
      clientTotalSpend: 25000,
      clientRating: 4.95,
      proposalsCount: 4,
      isPaymentVerified: true,
      postedDate: new Date(),
    };

    const result = fitCalculator.calculate(input);
    assert.equal(result.fitTier, 'LOW', 'Debe ser calificado como LOW FIT');
    assert.ok(result.overallScore <= 25, `El score debe ser <= 25, obtenido: ${result.overallScore}`);
    assert.equal(result.isCapped, true, 'Debe activar techo de seguridad');
    assert.equal(result.suggestedProofStory, null, 'No debe inventar ni forzar historias como PEPPER_AI');
  });

  // ADV-2: El Troyano de Bienes Raíces (Falso positivo anterior)
  it('ADV-2: Debe descalificar "Real Estate Acquisition Manager" sin coincidencias de queries (<= 35 pts)', () => {
    const input: FitCalculationInput = {
      title: 'Real Estate Acquisition Manager - High Paid Commission & Hourly Rate',
      description: 'We are seeking an experienced real estate agent and acquisition manager to close property deals.',
      activeQueries: userActiveQueries,
      clientCountry: 'United States',
      clientTotalSpend: 45000,
      clientRating: 4.98,
      proposalsCount: 2,
      isPaymentVerified: true,
      postedDate: new Date(),
    };

    const result = fitCalculator.calculate(input);
    assert.ok(result.overallScore <= 35, `El score debe ser <= 35, obtenido: ${result.overallScore}`);
    assert.equal(result.fitTier, 'LOW');
  });

  // ADV-3: Coincidencia Flexible de Expresiones (Variación de orden de palabras)
  it('ADV-3: Debe hacer match con "Product Designer (AI & Systems)" variando el orden de "AI product design" (>= 85 pts)', () => {
    const input: FitCalculationInput = {
      title: 'Senior Product Designer (AI & Complex Systems)',
      description: 'Seeking a senior product designer to lead our generative AI interfaces and design system workflows in Figma.',
      activeQueries: userActiveQueries,
      clientCountry: 'United States',
      clientTotalSpend: 35000,
      clientRating: 5.0,
      proposalsCount: 3,
      isPaymentVerified: true,
      postedDate: new Date(),
    };

    const result = fitCalculator.calculate(input);
    assert.equal(result.fitTier, 'HIGH', 'Debe ser HIGH FIT');
    assert.ok(result.overallScore >= 85, `El score debe ser >= 85, obtenido: ${result.overallScore}`);
    assert.equal(result.isCapped, false, 'No debe estar topado');
  });

  // ADV-4: El Millonario Irrelevante (QuickBooks Bookkeeping con $500k de gasto)
  it('ADV-4: Un cliente con $500k de gasto no debe inflar una tarea contable fuera de nicho (<= 40 pts)', () => {
    const input: FitCalculationInput = {
      title: 'QuickBooks Construction Bookkeeping & Tax Prep Cleanup',
      description: 'Need certified CPA / bookkeeper to reconcile 2025 construction expenses in QuickBooks.',
      activeQueries: userActiveQueries,
      clientTotalSpend: 500000, // Medio millón de dólares
      clientRating: 5.0,
      clientCountry: 'United States',
      proposalsCount: 3,
      isPaymentVerified: true,
      postedDate: new Date(),
    };

    const result = fitCalculator.calculate(input);
    assert.ok(result.overallScore <= 40, `El score no debe superar 40 a pesar del gasto, obtenido: ${result.overallScore}`);
    assert.equal(result.fitTier, 'LOW');
  });

  // ADV-5: Datos Faltantes de Apify (Renormalización Dinámica)
  it('ADV-5: No debe regalar bonos ficticios cuando faltan propuestas y fecha de publicación', () => {
    const input: FitCalculationInput = {
      title: 'Senior Figma Design System Lead',
      description: 'Looking for an expert to architect our multi-brand tokenized Figma design system.',
      activeQueries: userActiveQueries,
      proposalsCount: null, // Desconocido
      postedDate: null,     // Desconocido
      clientCountry: 'United States',
      clientTotalSpend: 15000,
      clientRating: 4.9,
      isPaymentVerified: true,
    };

    const result = fitCalculator.calculate(input);
    assert.equal(result.dataQualityStatus, 'INCOMPLETE', 'Debe marcar dataQualityStatus como INCOMPLETE');
    // Sin fecha ni propuestas no puede llegar al 100 perfecto
    assert.ok(result.overallScore < 95, `No debe alcanzar 100 sin datos completos, obtenido: ${result.overallScore}`);
    assert.ok(result.overallScore >= 70, `Aun así debe reconocer el match alto de la query, obtenido: ${result.overallScore}`);
  });

  // ADV-6: Penalización por Saturación de Mercado (> 50 propuestas)
  it('ADV-6: Una vacante con > 50 propuestas debe sufrir una penalización severa de competencia', () => {
    const inputHot: FitCalculationInput = {
      title: 'AI Product Design Lead',
      description: 'Build agentic AI workflows in Figma.',
      activeQueries: userActiveQueries,
      proposalsCount: 3,
      postedDate: new Date(),
      clientTotalSpend: 20000,
      clientRating: 5.0,
      isPaymentVerified: true,
    };

    const inputSaturated: FitCalculationInput = {
      ...inputHot,
      proposalsCount: 55, // Saturado
    };

    const scoreHot = fitCalculator.calculate(inputHot).overallScore;
    const scoreSaturated = fitCalculator.calculate(inputSaturated).overallScore;

    assert.ok(scoreHot - scoreSaturated >= 20, `La vacante saturada debe perder al menos 20 puntos por competencia. Hot: ${scoreHot}, Saturated: ${scoreSaturated}`);
  });

  // ADV-7: Cero Penalización al Fit por Fecha (La fecha es puramente recencyScore para desempate)
  it('ADV-7: Una vacante antigua con match perfecto conserva su afinidad (overallScore) pero refleja menor recencyScore', () => {
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);

    const inputFresh: FitCalculationInput = {
      title: 'UX Research and Usability Testing Specialist',
      description: 'Conduct user research and usability testing interviews.',
      activeQueries: userActiveQueries,
      postedDate: oneHourAgo,
      proposalsCount: 5,
      clientTotalSpend: 10000,
      clientRating: 5.0,
      isPaymentVerified: true,
    };

    const inputOld: FitCalculationInput = {
      ...inputFresh,
      postedDate: fiveDaysAgo,
    };

    const freshResult = fitCalculator.calculate(inputFresh);
    const oldResult = fitCalculator.calculate(inputOld);

    // Ambas deben tener 100 en afinidad porque ambas cumplen 100% las keywords
    assert.strictEqual(freshResult.overallScore, 100);
    assert.strictEqual(oldResult.overallScore, 100);
    // Pero la recencia debe reflejar la diferencia para ordenamiento secundario
    assert.ok(freshResult.recencyScore > oldResult.recencyScore, `La fresca (${freshResult.recencyScore}) debe tener mayor recencyScore que la antigua (${oldResult.recencyScore})`);
  });

  // ADV-8: Cliente Nuevo ($0 gastado) con Pago Verificado (No debe ser aplastado injustamente)
  it('ADV-8: Un cliente nuevo ($0 gastado) pero verificado y con rol afín debe mantenerse en MEDIUM o HIGH razonable', () => {
    const input: FitCalculationInput = {
      title: 'Agentic Workflow Design for SaaS Platform',
      description: 'Design autonomous AI agent workflows for our new SaaS platform.',
      activeQueries: userActiveQueries,
      clientTotalSpend: 0, // Cliente nuevo
      clientRating: 0,
      isPaymentVerified: true, // Pero con tarjeta verificada
      proposalsCount: 4,
      postedDate: new Date(),
    };

    const result = fitCalculator.calculate(input);
    assert.ok(result.overallScore >= 65, `Cliente nuevo verificado debe mantenerse >= 65, obtenido: ${result.overallScore}`);
  });

  // ADV-9: Vacante en Industria Tradicional pero con Software/Diseño Real
  it('ADV-9: "Build a Real Estate CRM & Design System" no debe ser confundido con agente de bienes raíces', () => {
    const input: FitCalculationInput = {
      title: 'Build a Real Estate CRM and Figma Design System',
      description: 'We are a property agency hiring a designer to build our custom CRM portal and Figma design system.',
      activeQueries: userActiveQueries,
      clientCountry: 'United States',
      clientTotalSpend: 30000,
      clientRating: 4.9,
      proposalsCount: 5,
      isPaymentVerified: true,
      postedDate: new Date(),
    };

    const result = fitCalculator.calculate(input);
    assert.equal(result.fitTier, 'HIGH', 'Debe ser HIGH FIT por coincidencia de design system');
    assert.ok(result.overallScore >= 80, `Score debe ser >= 80, obtenido: ${result.overallScore}`);
  });

  // ADV-10: Exclusión Geográfica
  it('ADV-10: Un país en la lista de exclusión debe ser topado a <= 15', () => {
    const input: FitCalculationInput = {
      title: 'Senior AI Product Designer',
      description: 'Design generative AI interfaces.',
      activeQueries: userActiveQueries,
      clientCountry: 'Russia',
      excludedCountries: ['Russia', 'Belarus'],
      clientTotalSpend: 50000,
      clientRating: 5.0,
      proposalsCount: 2,
      isPaymentVerified: true,
      postedDate: new Date(),
    };

    const result = fitCalculator.calculate(input);
    assert.equal(result.eligibilityStatus, 'EXCLUDED');
    assert.ok(result.overallScore <= 15, `Score de país excluido debe ser <= 15, obtenido: ${result.overallScore}`);
  });

  // ADV-11: La Vacante Dorada (Golden Lead) alcanza 100 Puntos
  it('ADV-11: Una vacante con match perfecto, cliente solvente, recién publicada y pocas propuestas debe alcanzar 100', () => {
    const input: FitCalculationInput = {
      title: 'Senior AI Product Design & Agentic Workflow Design Lead',
      description: 'Lead AI product design, Figma design system and agentic workflows for our Series A startup.',
      activeQueries: userActiveQueries,
      clientCountry: 'United States',
      clientTotalSpend: 85000,
      clientRating: 5.0,
      proposalsCount: 2,
      isPaymentVerified: true,
      postedDate: new Date(), // Menos de 1 hora
    };

    const result = fitCalculator.calculate(input);
    assert.equal(result.fitTier, 'HIGH');
    assert.equal(result.overallScore, 100, `El Golden Lead debe alcanzar 100 perfecto, obtenido: ${result.overallScore}`);
    assert.equal(result.isCapped, false);
  });
});
