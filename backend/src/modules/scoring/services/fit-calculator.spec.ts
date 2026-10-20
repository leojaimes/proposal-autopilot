import test, { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { RoleClassifierService } from './role-classifier.service';
import { FitCalculatorService, FitCalculationInput } from './fit-calculator.service';
import { StrategicLane } from '../constants/taxonomy.constants';

describe('Adversarial & Edge-Case Scoring Engine Suite (11 Casos)', () => {
  const roleClassifier = new RoleClassifierService();
  const fitCalculator = new FitCalculatorService(roleClassifier);

  // ADV-1: El Troyano de Bienes Raíces (El fallo real de producción)
  it('ADV-1: Debe descalificar "Real Estate Acquisition Manager" y topar el score en <= 44', () => {
    const input: FitCalculationInput = {
      title: 'Real Estate Acquisition Manager - High Paid Commission & Hourly Rate',
      description: 'We are seeking an experienced real estate agent and acquisition manager to close property deals.',
      clientCountry: 'United States',
      clientTotalSpend: 45000,
      clientRating: 4.98,
      proposalsCount: 2,
      isPaymentVerified: true,
      postedDate: new Date(),
    };

    const result = fitCalculator.calculate(input);
    assert.equal(result.strategicLane, StrategicLane.DISQUALIFIED_NOISE, 'Debe ser clasificado como DISQUALIFIED_NOISE');
    assert.ok(result.overallScore <= 44, `El score no debe superar 44, obtenido: ${result.overallScore}`);
    assert.equal(result.fitTier, 'LOW');
  });

  // ADV-2: El Agente Polisémico (Insurance / Call Center / Sales)
  it('ADV-2: No debe confundir "Insurance Sales Agent" o agentes comerciales con Agentes de IA', () => {
    const input: FitCalculationInput = {
      title: 'Insurance Sales Agent needed for outbound calls',
      description: 'Looking for licensed insurance agents to handle customer inquiries and call lists.',
      clientTotalSpend: 10000,
      clientRating: 5.0,
      isPaymentVerified: true,
      postedDate: new Date(),
    };

    const result = fitCalculator.calculate(input);
    assert.notEqual(result.strategicLane, StrategicLane.CORE_AI_UX, 'No debe ser CORE_AI_UX');
    assert.ok(result.overallScore <= 44, 'Debe ser calificado como LOW FIT');
  });

  // ADV-3: El Fantasma de Datos (Campos nulos desde Apify)
  it('ADV-3: No debe regalar bonos de baja competencia ni frescura a vacantes con datos faltantes', () => {
    const input: FitCalculationInput = {
      title: 'AI Agent Architect for LangGraph Multi-Agent System',
      description: 'Build an autonomous multi-agent workflow using LangGraph, Python and OpenAI.',
      proposalsCount: undefined, // Dato desconocido
      postedDate: undefined,     // Dato desconocido
      clientCountry: undefined,  // Dato desconocido
      clientTotalSpend: 5000,
      clientRating: 5.0,
      isPaymentVerified: true,
    };

    const result = fitCalculator.calculate(input);
    assert.equal(result.dataQualityStatus, 'INCOMPLETE', 'Debe marcar dataQualityStatus como INCOMPLETE');
    // Si proposalsCount es undefined, no debe tener el bono de +10 / +15
    assert.ok(result.overallScore < 95, 'No debe inflar el score al máximo sin datos de competencia o tiempo');
  });

  // ADV-4: El Millonario Irrelevante (QuickBooks Bookkeeping con $500k de gasto)
  it('ADV-4: Un cliente con $500k de gasto no debe inflar una tarea contable fuera de nicho', () => {
    const input: FitCalculationInput = {
      title: 'QuickBooks Construction Bookkeeping & Tax Prep Cleanup',
      description: 'Need certified CPA / bookkeeper to reconcile 2025 construction expenses in QuickBooks.',
      clientTotalSpend: 500000, // Medio millón de dólares
      clientRating: 5.0,
      clientCountry: 'United States',
      isPaymentVerified: true,
      proposalsCount: 1,
      postedDate: new Date(),
    };

    const result = fitCalculator.calculate(input);
    assert.ok(result.isCapped, 'Debe activar el Safety Cap');
    assert.ok(result.overallScore <= 44, `El score debe toparse en 44 máximo, obtenido: ${result.overallScore}`);
    assert.equal(result.fitTier, 'LOW');
  });

  // ADV-5: La Joya de Backend No-IA (NestJS, PostgreSQL, APIs)
  it('ADV-5: Debe reconocer y premiar vacantes legítimas de Backend/APIs aunque no mencionen "AI" ni "Figma"', () => {
    const input: FitCalculationInput = {
      title: 'Senior NestJS & PostgreSQL Developer for High-Throughput REST API',
      description: 'We need an experienced TypeScript / NestJS architect to design microservices and optimize Prisma queries.',
      skills: ['NestJS', 'PostgreSQL', 'TypeScript', 'Docker'],
      clientTotalSpend: 35000,
      clientRating: 4.95,
      clientCountry: 'United States',
      isPaymentVerified: true,
      proposalsCount: 3,
      postedDate: new Date(),
    };

    const result = fitCalculator.calculate(input);
    assert.notEqual(result.strategicLane, StrategicLane.DISQUALIFIED_NOISE);
    assert.ok(result.overallScore >= 75, `Debe calificar como HIGH FIT (>=75), obtenido: ${result.overallScore}`);
    assert.equal(result.fitTier, 'HIGH');
  });

  // ADV-6: Evasión Geográfica con clientCountry nulo
  it('ADV-6: No debe eludir el filtro estricto cuando clientCountry es null en modo STRICT_EXCLUDE', () => {
    const input: FitCalculationInput = {
      title: 'Senior AI UX Designer for Mobile App',
      description: 'Design Figma tokens and conversational flows.',
      clientCountry: undefined,
      geoFilterMode: 'STRICT_EXCLUDE',
      targetCountries: ['United States', 'Canada', 'United Kingdom'],
      clientTotalSpend: 20000,
      clientRating: 5.0,
      isPaymentVerified: true,
      postedDate: new Date(),
    };

    const result = fitCalculator.calculate(input);
    assert.equal(result.eligibilityStatus, 'PENDING', 'Debe marcar como PENDING por país no verificado');
    assert.ok(result.overallScore <= 44, 'No debe declarar elegible a un cliente con país desconocido en modo estricto');
  });

  // ADV-7: La Oportunidad Perfecta (Alcance real hasta 100)
  it('ADV-7: Una vacante perfecta en todos sus factores debe poder alcanzar 100 puntos exactos', () => {
    const input: FitCalculationInput = {
      title: 'Lead AI Agent Architect & Next.js Fullstack Engineer',
      description: 'Build autonomous agent workflows with LangGraph, NestJS, and interactive human-in-the-loop UX.',
      skills: ['AI Agents', 'LangGraph', 'NestJS', 'TypeScript'],
      clientTotalSpend: 150000,
      clientRating: 5.0,
      clientCountry: 'United States',
      targetCountries: ['United States'],
      isPaymentVerified: true,
      proposalsCount: 2,
      postedDate: new Date(), // Publicado ahora mismo
    };

    const result = fitCalculator.calculate(input);
    assert.equal(result.overallScore, 100, `El score perfecto debe ser 100, obtenido: ${result.overallScore}`);
    assert.equal(result.fitTier, 'HIGH');
    assert.equal(result.eligibilityStatus, 'ELIGIBLE');
  });

  // ADV-8: Eliminación del Doble Conteo de IA
  it('ADV-8: La viabilidad debe medir fricción de mercado y no duplicar puntos por decir "AI"', () => {
    const input: FitCalculationInput = {
      title: 'AI UX Review',
      description: 'Quick review of an AI chatbot screen.',
      proposalsCount: 65, // Mercado hipersaturado (>50 propuestas)
      clientTotalSpend: 100,
      isPaymentVerified: false,
      postedDate: new Date(Date.now() - 72 * 3600 * 1000), // Hace 3 días
    };

    const result = fitCalculator.calculate(input);
    assert.ok(result.aiFeasibilityScore <= 35, 'Viabilidad debe ser castigada por saturación independientemente de que mencione AI');
    assert.equal(result.fitTier, 'LOW');
  });

  // ADV-9: La Joya Inmobiliaria (Software legítimo para empresa de Real Estate)
  it('ADV-9: "Build a Real Estate Acquisition SaaS" no debe excluirse solo por la industria del cliente', () => {
    const input: FitCalculationInput = {
      title: 'Build a Real Estate Acquisition & Deal Sourcing SaaS Platform',
      description: 'We are a real estate investment firm needing a Senior Fullstack Architect to build a custom CRM and analytics portal in NestJS and React.',
      skills: ['SaaS', 'NestJS', 'React', 'PostgreSQL'],
      clientCountry: 'United States',
      clientTotalSpend: 60000,
      clientRating: 4.95,
      isPaymentVerified: true,
      proposalsCount: 4,
      postedDate: new Date(),
    };

    const result = fitCalculator.calculate(input);
    assert.notEqual(result.strategicLane, StrategicLane.DISQUALIFIED_NOISE, 'No debe confundir la industria del cliente con el rol de desarrollo');
    assert.ok(result.overallScore >= 75, `Debe ser calificado como HIGH FIT (>=75), obtenido: ${result.overallScore}`);
  });

  // ADV-10: Control de Ausencia de Datos (Incompleto vs Completo)
  it('ADV-10: Una vacante con datos faltantes jamás puede puntuar más alto que una idéntica con datos perfectos', () => {
    const baseInput = {
      title: 'Senior AI UX Designer',
      description: 'Design Figma tokens for an agentic SaaS.',
      clientTotalSpend: 25000,
      clientRating: 5.0,
      isPaymentVerified: true,
    };

    const jobCompleto = fitCalculator.calculate({
      ...baseInput,
      proposalsCount: 3,
      postedDate: new Date(),
      clientCountry: 'United States',
    });

    const jobIncompleto = fitCalculator.calculate({
      ...baseInput,
      proposalsCount: undefined,
      postedDate: undefined,
      clientCountry: undefined,
    });

    assert.ok(
      jobCompleto.overallScore >= jobIncompleto.overallScore,
      `El empleo completo (${jobCompleto.overallScore}) debe ser mayor o igual al incompleto (${jobIncompleto.overallScore})`
    );
  });

  // ADV-11: Inviolabilidad de Exclusión Geográfica
  it('ADV-11: Un proyecto con métricas excelentes pero en país excluido debe quedar en EXCLUDED con score <= 15', () => {
    const input: FitCalculationInput = {
      title: 'Lead AI Engineer',
      description: 'Build enterprise LLM pipelines.',
      clientCountry: 'North Korea',
      excludedCountries: ['North Korea', 'Russia', 'Iran'],
      geoFilterMode: 'STRICT_EXCLUDE',
      clientTotalSpend: 100000,
      clientRating: 5.0,
      isPaymentVerified: true,
      proposalsCount: 1,
      postedDate: new Date(),
    };

    const result = fitCalculator.calculate(input);
    assert.equal(result.eligibilityStatus, 'EXCLUDED');
    assert.equal(result.overallScore, 15);
  });
});
