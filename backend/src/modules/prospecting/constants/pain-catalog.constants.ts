import { CompanyPainCategory } from '@prisma/client';

export interface PainCatalogSeedItem {
  code: string;
  categoryEnum: CompanyPainCategory;
  name: string;
  description: string;
  suggestedOffer: string;
  baseTicketUsd: number;
  monthlyRetainerUsd: number | null;
  priorityWeight: number;
  pitchTemplateOwner: string;
  pitchTemplateGatekeeper: string;
  pitchTemplateEnterprise: string;
  detectionRules: {
    requiresNoWebsite?: boolean;
    requiresBrokenWebsite?: boolean;
    keywords?: string[];
    minKeywordMatches?: number;
    maxRatingThreshold?: number;
    defaultConfidence: number;
  };
}

export const CANONICAL_PAIN_CATALOG: PainCatalogSeedItem[] = [
  {
    code: 'WEBSITE_DOWN_OR_EXPIRED',
    categoryEnum: CompanyPainCategory.WEBSITE_DOWN_OR_EXPIRED,
    name: 'Dominio Caído o Sitio Web Fuera de Línea',
    description:
      'El enlace web registrado en Google Maps devuelve error DNS, 404/5xx o apunta a un dominio expirado/aparcado.',
    suggestedOffer: 'Reactivación Urgente de Dominio + Sitio Web Moderno de Alta Conversión con SSL',
    baseTicketUsd: 650,
    monthlyRetainerUsd: 25,
    priorityWeight: 100,
    pitchTemplateOwner:
      'Hola, equipo de {{name}}. Intenté entrar hoy a su página web desde su ficha de Google Maps en {{city}} ({{rating}}⭐ con {{reviewsCount}} reseñas) y noté que el sitio está caído / fuera de línea, por lo que están perdiendo pacientes y clientes que intentan contactarlos. Podemos reactivarles una versión moderna, segura y ultra rápida en menos de 48 horas. ¿Les comparto el diagnóstico?',
    pitchTemplateGatekeeper:
      'Hola buen día. Disculpa la molestia: notamos que la página web oficial de {{name}} que aparece en Google Maps marca error al abrir. ¿Con quién del área administrativa o gerencia podría reportarlo para ayudarles a restablecerla?',
    pitchTemplateEnterprise:
      'Estimado equipo directivo de {{name}}: detectamos una interrupción activa en el sitio web vinculado a sus ubicaciones en {{city}} ({{branchCount}} sedes monitoreadas). Contamos con infraestructura de alta disponibilidad para restablecer y centralizar sus portales locales. ¿Con quién de TI o Expansión podemos agendar 10 minutos?',
    detectionRules: {
      requiresBrokenWebsite: true,
      defaultConfidence: 0.99,
    },
  },
  {
    code: 'NO_WEBSITE',
    categoryEnum: CompanyPainCategory.NO_WEBSITE,
    name: 'Sin Sitio Web Oficial Propio',
    description:
      'El negocio cuenta con reputación activa en Google Maps pero carece de dominio propio o solo enlaza redes sociales.',
    suggestedOffer: 'Desarrollo de Sitio Web Corporativo de Alta Velocidad + Posicionamiento SEO Local',
    baseTicketUsd: 450,
    monthlyRetainerUsd: null,
    priorityWeight: 90,
    pitchTemplateOwner:
      'Hola, equipo de {{name}}. Noté que en {{city}} tienen excelente reputación ({{rating}}⭐ con {{reviewsCount}} reseñas en Google Maps), pero aún no cuentan con un sitio web oficial propio. Hoy el 75% de los clientes verifican una web antes de acudir. Desarrollamos sitios rápidos que posicionan en Google y convierten visitas en citas directas. ¿Les gustaría ver una propuesta visual sin compromiso?',
    pitchTemplateGatekeeper:
      'Hola buen día. Vi la excelente calificación de {{name}} en Google Maps en {{city}} y preparé una maqueta digital para su presencia web oficial. ¿Con quién de gerencia o dirección podría compartirla brevemente?',
    pitchTemplateEnterprise:
      'Hola equipo de {{name}}. Observamos que varias de sus sucursales en {{city}} carecen de landing pages locales optimizadas para conversión en Google Maps. Diseñamos micrositios multi-sucursal que capturan tráfico orgánico local. ¿A qué correo corporativo podemos enviar el caso de negocio?',
    detectionRules: {
      requiresNoWebsite: true,
      defaultConfidence: 0.95,
    },
  },
  {
    code: 'NO_ONLINE_BOOKING',
    categoryEnum: CompanyPainCategory.NO_ONLINE_BOOKING,
    name: 'Fricción al Agendar Citas / Sin Reserva 24/7',
    description:
      'Reseñas evidencian demoras para agendar, empalmes de horarios, tiempos de espera o cancelaciones sin aviso.',
    suggestedOffer: 'Plataforma de Agendamiento Online 24/7 + Recordatorios Automáticos por WhatsApp',
    baseTicketUsd: 550,
    monthlyRetainerUsd: 40,
    priorityWeight: 85,
    pitchTemplateOwner:
      'Hola {{name}}. Revisando sus reseñas en Google en {{city}} felicidades por su servicio; noté que algunos clientes mencionan demoras al agendar o confirmar citas. Implementamos una agenda online donde sus clientes reservan en 30 segundos con recordatorios automáticos por WhatsApp, reduciendo inasistencias un 40%. ¿Les muestro un demo de 2 minutos?',
    pitchTemplateGatekeeper:
      'Hola buen día, equipo de {{name}}. Sé que en recepción reciben muchísimas solicitudes de citas al día; tenemos un asistente de confirmación automática por WhatsApp que les ahorra horas de llamadas. ¿Con quién de administración podría platicarlo 3 minutos?',
    pitchTemplateEnterprise:
      'Hola equipo de operaciones de {{name}}. Analizando la experiencia de usuario en sus sedes de {{city}}, detectamos cuellos de botella recurrentes en agendamiento y tiempos de espera. Ofrecemos un motor centralizado de reservas multi-sede con balanceo de horarios y confirmación en WhatsApp. ¿Podemos agendar una breve llamada ejecutiva?',
    detectionRules: {
      keywords: ['cita', 'citas', 'agendar', 'turno', 'espera', 'esperar', 'horario', 'cancelaron', 'agendé', 'appointment', 'booking'],
      minKeywordMatches: 1,
      maxRatingThreshold: 4.3,
      defaultConfidence: 0.88,
    },
  },
  {
    code: 'UNRESPONSIVE_CUSTOMER_SERVICE',
    categoryEnum: CompanyPainCategory.UNRESPONSIVE_CUSTOMER_SERVICE,
    name: 'Atención Telefónica o WhatsApp Desatendido',
    description:
      'Clientes reportan en reseñas que no contestan llamadas, tardan horas en responder WhatsApp o pierden prospectos fuera de horario.',
    suggestedOffer: 'Agente de IA para WhatsApp 24/7 con Cotización y Atención Inmediata',
    baseTicketUsd: 650,
    monthlyRetainerUsd: 65,
    priorityWeight: 82,
    pitchTemplateOwner:
      'Hola {{name}}. Vi su presencia en Google en {{city}} y noté que varios clientes buscan información fuera de horario o comentan dificultad para comunicarse rápido. Implementamos Agentes de IA en WhatsApp que responden precios, ubicación y dudas en menos de 5 segundos, 24/7. ¿Les gustaría probar un demo personalizado con el nombre de {{name}}?',
    pitchTemplateGatekeeper:
      'Hola buen día. Quería compartir con el encargado o administrador de {{name}} una herramienta que responde automáticamente las preguntas repetitivas de horarios y ubicación en WhatsApp para descargar el teléfono de recepción. ¿Me podrías indicar a quién dirigirla?',
    pitchTemplateEnterprise:
      'Estimado equipo comercial de {{name}}: identificamos menciones en reseñas sobre saturación telefónica en sus sucursales de {{city}}. Nuestro Agente Conversacional IA atiende 100% del flujo entrante de WhatsApp 24/7 y enruta leads calificados a cada sucursal. ¿Con quién del área de Experiencia de Cliente podemos conversar?',
    detectionRules: {
      keywords: [
        'no contestan',
        'no responden',
        'nadie contesta',
        'pésima atención',
        'pesima atencion',
        'tardan en contestar',
        'whatsapp',
        'nunca contestan',
        'no atienden',
      ],
      minKeywordMatches: 1,
      defaultConfidence: 0.86,
    },
  },
  {
    code: 'MANUAL_INVENTORY_OR_CATALOG',
    categoryEnum: CompanyPainCategory.MANUAL_INVENTORY_OR_CATALOG,
    name: 'Cotización Manual y Falta de Catálogo Digital',
    description:
      'Clientes solicitan precios, existencias o catálogo constantemente y dependen de atención manual o PDFs pesados.',
    suggestedOffer: 'Catálogo Digital Interactivo + Cotizador Automático directo a WhatsApp',
    baseTicketUsd: 550,
    monthlyRetainerUsd: null,
    priorityWeight: 72,
    pitchTemplateOwner:
      'Hola {{name}}. Encontramos su negocio en Google Maps en {{city}} y vimos una gran oportunidad para agilizar cómo sus clientes consultan productos y precios. Diseñamos catálogos digitales interactivos que cotizan al instante y envían el pedido listo a su WhatsApp. ¿Tienen 5 minutos esta semana para ver un ejemplo de su giro?',
    pitchTemplateGatekeeper:
      'Hola buen día. Desarrollamos catálogos interactivos para que los clientes armen su cotización solos antes de escribirles por WhatsApp. ¿Con quién del área de ventas o gerencia de {{name}} podría compartir un ejemplo?',
    pitchTemplateEnterprise:
      'Hola equipo de {{name}}. Ofrecemos catálogos digitales sincronizados con inventario por sucursal en {{city}} para automatizar cotizaciones B2B/B2C. ¿Con qué responsable comercial podemos coordinar una demostración?',
    detectionRules: {
      keywords: ['precio', 'precios', 'costo', 'cotizar', 'cotización', 'catálogo', 'catalogo', 'inventario', 'existencia', 'stock', 'menú', 'menu'],
      minKeywordMatches: 1,
      defaultConfidence: 0.78,
    },
  },
  {
    code: 'LACK_OF_ECOMMERCE',
    categoryEnum: CompanyPainCategory.LACK_OF_ECOMMERCE,
    name: 'Ventas Manuales sin Pasarela de Pago en Línea',
    description:
      'Comercio con venta de productos que obliga a validar transferencias manuales o carece de checkout con tarjeta.',
    suggestedOffer: 'Tienda Online + Checkout en 1 Clic (Stripe / Mercado Pago)',
    baseTicketUsd: 850,
    monthlyRetainerUsd: null,
    priorityWeight: 70,
    pitchTemplateOwner:
      'Hola {{name}}. Vimos sus productos en {{city}} y notamos potencial para que sus clientes compren y paguen con tarjeta en 1 clic sin validar comprobantes manuales por chat. Implementamos tiendas rápidas listas para cobrar 24/7. ¿Les interesaría ver cómo quedaría para {{name}}?',
    pitchTemplateGatekeeper:
      'Hola buen día. Quisiera hacer llegar a la administración de {{name}} una propuesta para habilitar cobros automáticos en línea y envíos. ¿A qué correo o contacto de gerencia puedo enviarla?',
    pitchTemplateEnterprise:
      'Hola dirección de e-commerce de {{name}}: habilitamos experiencias de compra omnicanal (Click & Collect por sucursal en {{city}}) con conciliación automática. ¿Con quién podemos evaluar una integración piloto?',
    detectionRules: {
      keywords: ['envío', 'envio', 'transferencia', 'comprar en línea', 'tienda en linea', 'pago con tarjeta', 'pedido a domicilio'],
      minKeywordMatches: 1,
      defaultConfidence: 0.76,
    },
  },
  {
    code: 'GENERAL_REPUTATION_ISSUE',
    categoryEnum: CompanyPainCategory.GENERAL_REPUTATION_ISSUE,
    name: 'Fricción de Reputación y Seguimiento Post-Venta',
    description:
      'Calificación menor a 4.0 estrellas en Google Maps por falta de visibilidad en el estado de órdenes o quejas no contenidas.',
    suggestedOffer: 'Portal de Estatus para Clientes + Filtro Preventivo de Reseñas en Google',
    baseTicketUsd: 750,
    monthlyRetainerUsd: 45,
    priorityWeight: 75,
    pitchTemplateOwner:
      'Hola {{name}}. Notamos en Google Maps en {{city}} que tienen gran volumen de clientes, aunque algunas reseñas reflejan dudas sobre tiempos de entrega o seguimiento. Implementamos portales de estatus en tiempo real y encuestas privadas que resuelven inconformidades antes de afectar su calificación en Google. ¿Platicamos 5 minutos?',
    pitchTemplateGatekeeper:
      'Hola buen día. Tenemos un sistema de calidad al cliente que ayuda a subir la calificación de estrellas en Google Maps para negocios en {{city}}. ¿Con quién de gerencia de {{name}} podría comentarlo?',
    pitchTemplateEnterprise:
      'Estimada dirección operativa de {{name}}: ayudamos a cadenas en {{city}} a blindar su reputación en Google Maps mediante monitoreo por sucursal y contención temprana de incidencias. ¿Me indican el contacto de Operaciones o CX?',
    detectionRules: {
      keywords: ['demora', 'retraso', 'mal servicio', 'tardaron', 'queja', 'incumplieron', 'garantía'],
      minKeywordMatches: 1,
      maxRatingThreshold: 3.9,
      defaultConfidence: 0.82,
    },
  },
  {
    code: 'OUTDATED_OR_SLOW_WEB',
    categoryEnum: CompanyPainCategory.OUTDATED_OR_SLOW_WEB,
    name: 'Sitio Web Lento, Antiguo o Sin Optimización Móvil',
    description:
      'El negocio cuenta con página web pero usa HTTP inseguro o carece de embudo moderno de conversión móvil.',
    suggestedOffer: 'Rediseño Web Móvil Ultra-Rápido + Embudo de Conversión Directa a WhatsApp',
    baseTicketUsd: 600,
    monthlyRetainerUsd: null,
    priorityWeight: 50,
    pitchTemplateOwner:
      'Hola, equipo de {{name}}. Revisamos su presencia digital en {{city}} ({{rating}}⭐ en Google Maps) y detectamos áreas clave de mejora móvil y velocidad en su sitio actual para duplicar los prospectos que llegan a su WhatsApp. ¿Les gustaría recibir una auditoría rápida sin costo?',
    pitchTemplateGatekeeper:
      'Hola buen día. Realizamos un breve diagnóstico de velocidad y conversión móvil sobre la página web de {{name}}. ¿Con quién del área de marketing o dirección podría compartirlo?',
    pitchTemplateEnterprise:
      'Hola equipo digital de {{name}}: auditamos el rendimiento Core Web Vitals de sus páginas en {{city}} y detectamos oportunidades para incrementar la conversión orgánica móvil. ¿Con quién de Marketing Digital podemos compartir el reporte técnico?',
    detectionRules: {
      defaultConfidence: 0.65,
    },
  },
];

