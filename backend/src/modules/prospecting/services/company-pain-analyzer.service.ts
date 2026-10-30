import { Injectable, Logger } from '@nestjs/common';
import { CompanyPainCategory } from '@prisma/client';

export interface BusinessAnalysisInput {
  name: string;
  category?: string;
  city?: string;
  websiteUrl?: string;
  rating?: number;
  reviewsCount?: number;
  reviewsSnippets?: string[];
}

export interface PainDiagnosisResult {
  primaryPain: CompanyPainCategory;
  painConfidence: number;
  detectedPainSummary: string;
  suggestedOffer: string;
  salesPitchDraft: string;
  painAnalysisDetails: {
    hasWebsite: boolean;
    negativeReviewsFound: number;
    flaggedKeywords: string[];
    sentimentScore: 'POSITIVE' | 'NEUTRAL' | 'CRITICAL_PAIN';
  };
}

@Injectable()
export class CompanyPainAnalyzerService {
  private readonly logger = new Logger(CompanyPainAnalyzerService.name);

  analyze(input: BusinessAnalysisInput): PainDiagnosisResult {
    const { name, category = 'Negocio', city = 'su localidad', websiteUrl, rating = 4.5, reviewsCount = 0, reviewsSnippets = [] } = input;
    const hasWebsite = Boolean(websiteUrl && websiteUrl.startsWith('http') && !websiteUrl.includes('facebook.com') && !websiteUrl.includes('instagram.com'));
    
    const combinedReviews = (reviewsSnippets || []).join(' ').toLowerCase();

    // Heuristic 1: No website or only social media page
    if (!hasWebsite) {
      return {
        primaryPain: CompanyPainCategory.NO_WEBSITE,
        painConfidence: 0.95,
        detectedPainSummary: `${name} no cuenta con sitio web oficial propio (o solo utiliza redes sociales), perdiendo captación orgánica directa y confianza de clientes calificados.`,
        suggestedOffer: 'Desarrollo de Sitio Web Corporativo de Alta Velocidad + Posicionamiento SEO Local',
        salesPitchDraft: `Hola, equipo de ${name}. Noté que en ${city} tienen excelente reputación (${rating}⭐ con ${reviewsCount} reseñas en Google Maps), pero aún no cuentan con un sitio web oficial propio. Hoy en día el 75% de los clientes verifican una página antes de acudir. Desarrollamos sitios web modernos que se posicionan en los primeros lugares de Google y convierten visitantes en clientes directos. ¿Les gustaría ver una propuesta visual sin compromiso?`,
        painAnalysisDetails: {
          hasWebsite: false,
          negativeReviewsFound: 0,
          flaggedKeywords: ['no_website', 'social_only'],
          sentimentScore: 'CRITICAL_PAIN',
        },
      };
    }

    // Heuristic 2: Booking / Appointments pain keywords in reviews
    const bookingKeywords = ['cita', 'agendar', 'turno', 'espera', 'esperar', 'horario', 'cancelaron', 'agendé'];
    const matchedBooking = bookingKeywords.filter(k => combinedReviews.includes(k));
    if (matchedBooking.length >= 2 || (matchedBooking.length >= 1 && rating < 4.2)) {
      return {
        primaryPain: CompanyPainCategory.NO_ONLINE_BOOKING,
        painConfidence: 0.88,
        detectedPainSummary: `Los clientes señalan fricción y demoras al intentar agendar o confirmar citas en ${name}.`,
        suggestedOffer: 'Plataforma de Agendamiento Online 24/7 con Sincronización de Calendario y Recordatorios SMS/WhatsApp',
        salesPitchDraft: `Hola ${name}. Estuve revisando sus comentarios en Google en ${city} y felicidades por el servicio que ofrecen. Noté que algunos usuarios comentan demoras al agendar o confirmar citas por teléfono. Desarrollamos una solución ligera de agenda en línea donde sus clientes reservan en 30 segundos y reciben recordatorios automáticos, reduciendo inasistencias en un 40%. ¿Les gustaría ver una demo de 2 minutos?`,
        painAnalysisDetails: {
          hasWebsite: true,
          negativeReviewsFound: matchedBooking.length,
          flaggedKeywords: matchedBooking,
          sentimentScore: 'CRITICAL_PAIN',
        },
      };
    }

    // Heuristic 3: Customer Service / WhatsApp / No answer
    const supportKeywords = ['no contestan', 'no responden', 'nadie contesta', 'pésima atención', 'tardan en contestar', 'teléfono', 'whatsapp'];
    const matchedSupport = supportKeywords.filter(k => combinedReviews.includes(k));
    if (matchedSupport.length >= 1) {
      return {
        primaryPain: CompanyPainCategory.UNRESPONSIVE_CUSTOMER_SERVICE,
        painConfidence: 0.85,
        detectedPainSummary: `Quejas recurrentes sobre falta de respuesta inmediata en llamadas y WhatsApp en ${name}.`,
        suggestedOffer: 'Asistente Virtual con IA para WhatsApp que atiende, cotiza y filtra clientes 24/7',
        salesPitchDraft: `Hola ${name}. Vi sus reseñas en Google en ${city}. Muchos clientes buscan información fuera de horario de oficina y comentan que es difícil comunicarse. Implementamos agentes de Inteligencia Artificial para WhatsApp que responden dudas de servicios, precios y horarios en menos de 5 segundos, los 7 días de la semana. ¿Les interesaría probar un demo con el nombre de su negocio?`,
        painAnalysisDetails: {
          hasWebsite: true,
          negativeReviewsFound: matchedSupport.length,
          flaggedKeywords: matchedSupport,
          sentimentScore: 'CRITICAL_PAIN',
        },
      };
    }

    // Heuristic 4: Inventory / Catalog / Pricing friction
    const catalogKeywords = ['precio', 'costo', 'cotizar', 'catálogo', 'inventario', 'no tienen'];
    const matchedCatalog = catalogKeywords.filter(k => combinedReviews.includes(k));
    if (matchedCatalog.length >= 1) {
      return {
        primaryPain: CompanyPainCategory.MANUAL_INVENTORY_OR_CATALOG,
        painConfidence: 0.78,
        detectedPainSummary: `Dificultad de los clientes para consultar precios, catálogo de productos o disponibilidad de forma ágil en ${name}.`,
        suggestedOffer: 'Catálogo Digital Interactivo con Cotizador Automático B2B/B2C',
        salesPitchDraft: `Hola ${name}. Encontramos su negocio en Google Maps en ${city}. Notamos una gran oportunidad para agilizar cómo sus clientes consultan sus servicios y precios. Diseñamos catálogos digitales interactivos que permiten cotizar al instante y recibir los pedidos directamente en su WhatsApp. ¿Tienen 5 minutos esta semana para mostrarles un ejemplo para su sector?`,
        painAnalysisDetails: {
          hasWebsite: true,
          negativeReviewsFound: matchedCatalog.length,
          flaggedKeywords: matchedCatalog,
          sentimentScore: 'NEUTRAL',
        },
      };
    }

    // Default: Outdated Web / Performance upgrade
    return {
      primaryPain: CompanyPainCategory.OUTDATED_OR_SLOW_WEB,
      painConfidence: 0.70,
      detectedPainSummary: `${name} tiene presencia digital básica, pero su sitio web tiene potencial de modernización para mejorar conversión y velocidad móvil.`,
      suggestedOffer: 'Rediseño Web de Alto Impacto con Optimización para Dispositivos Móviles y SEO',
      salesPitchDraft: `Hola, equipo de ${name}. Vi su perfil en Google Maps en ${city} con ${rating}⭐. Su negocio tiene una sólida base de clientes, pero su página web actual podría optimizarse significativamente para cargar más rápido en celulares y captar más cotizaciones directas. ¿Podemos enviarles una auditoría visual rápida de 3 puntos clave de mejora?`,
      painAnalysisDetails: {
        hasWebsite: true,
        negativeReviewsFound: 0,
        flaggedKeywords: ['general_refresh'],
        sentimentScore: 'POSITIVE',
      },
    };
  }
}

