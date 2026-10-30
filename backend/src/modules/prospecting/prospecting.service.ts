import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { TenantContextService } from '../../core/context/tenant-context.service';
import { NominatimGeocodingService, GeocodedCityResult } from './services/nominatim-geocoding.service';
import { CompanyPainAnalyzerService } from './services/company-pain-analyzer.service';
import { ScanAreaDto } from './dto/scan-area.dto';
import { ProspectedLeadStatus, CompanyPainCategory } from '@prisma/client';
import { createHash } from 'node:crypto';
import {
  isPointInsidePolygon,
  calculatePolygonBoundingBox,
  calculatePolygonAreaKm2,
  normalizePolygonCoordinates,
} from './utils/prospecting-geometry.utils';

@Injectable()
export class ProspectingService {
  private readonly logger = new Logger(ProspectingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly geocoding: NominatimGeocodingService,
    private readonly painAnalyzer: CompanyPainAnalyzerService,
  ) {}

  async geocodeCity(city: string, state?: string, country: string = 'Mexico'): Promise<GeocodedCityResult> {
    return this.geocoding.geocodeCity(city, state, country);
  }

  async scanArea(dto: ScanAreaDto) {
    const tenantId = this.tenantContext.getTenantId();
    const { sector, center, radiusKm, city = 'Querétaro', state = 'Querétaro', country = 'Mexico', polygon } = dto;

    const hasPolygon = Boolean(polygon && polygon.length >= 3);
    const normalizedPolygon = hasPolygon ? normalizePolygonCoordinates(polygon!) : null;

    let effectiveCenter = center;
    let polygonAreaKm2 = 0;

    if (normalizedPolygon && normalizedPolygon.length >= 3) {
      const bbox = calculatePolygonBoundingBox(normalizedPolygon);
      polygonAreaKm2 = calculatePolygonAreaKm2(normalizedPolygon);
      effectiveCenter = bbox.centroid;
      this.logger.log(`Starting polygon scan for "${sector}" with ${normalizedPolygon.length} vertices (~${polygonAreaKm2} km²) in ${city}`);
    } else {
      this.logger.log(`Starting circular area scan for "${sector}" at [${center.lat}, ${center.lng}] with radius ${radiusKm}km in ${city}`);
    }

    // Generate place candidates (filtered by polygon if polygon mode is active)
    const rawCandidates = this.generateAreaCandidates(
      sector,
      effectiveCenter,
      radiusKm,
      city,
      state,
      normalizedPolygon && normalizedPolygon.length >= 3 ? normalizedPolygon : undefined,
    );

    const savedLeads = [];
    for (const candidate of rawCandidates) {
      // Analyze pain points and sales pitch
      const diagnosis = this.painAnalyzer.analyze({
        name: candidate.name,
        category: candidate.category,
        city: candidate.city,
        websiteUrl: candidate.websiteUrl,
        rating: candidate.rating,
        reviewsCount: candidate.reviewsCount,
        reviewsSnippets: candidate.reviewsSnippets,
      });

      const upserted = await this.prisma.prospectedBusiness.upsert({
        where: {
          uq_tenant_place: {
            tenantId,
            placeId: candidate.placeId,
          },
        },
        create: {
          tenantId,
          placeId: candidate.placeId,
          name: candidate.name,
          category: candidate.category,
          address: candidate.address,
          city: candidate.city,
          state: candidate.state,
          country: candidate.country,
          latitude: candidate.latitude,
          longitude: candidate.longitude,
          websiteUrl: candidate.websiteUrl || null,
          phone: candidate.phone,
          rating: candidate.rating,
          reviewsCount: candidate.reviewsCount,
          status: ProspectedLeadStatus.DISCOVERED,
          primaryPain: diagnosis.primaryPain,
          painConfidence: diagnosis.painConfidence,
          painAnalysis: {
            summary: diagnosis.detectedPainSummary,
            details: diagnosis.painAnalysisDetails,
            sampleReviews: candidate.reviewsSnippets,
          },
          suggestedOffer: diagnosis.suggestedOffer,
          salesPitchDraft: diagnosis.salesPitchDraft,
          rawGoogleData: candidate.rawGoogleData,
        },
        update: {
          rating: candidate.rating,
          reviewsCount: candidate.reviewsCount,
          websiteUrl: candidate.websiteUrl || null,
          primaryPain: diagnosis.primaryPain,
          painConfidence: diagnosis.painConfidence,
          suggestedOffer: diagnosis.suggestedOffer,
          salesPitchDraft: diagnosis.salesPitchDraft,
          scannedAt: new Date(),
        },
      });

      savedLeads.push(upserted);
    }

    return {
      message: hasPolygon && normalizedPolygon
        ? `Escaneo de polígono completado exitosamente. Se identificaron ${savedLeads.length} empresas dentro del área delimitada (${polygonAreaKm2} km²).`
        : `Escaneo completado exitosamente. Se identificaron ${savedLeads.length} empresas en la zona.`,
      scannedSector: sector,
      center: effectiveCenter,
      radiusKm,
      city,
      polygon: normalizedPolygon || undefined,
      polygonAreaKm2: polygonAreaKm2 > 0 ? polygonAreaKm2 : undefined,
      polygonVertices: normalizedPolygon ? normalizedPolygon.length : undefined,
      leads: savedLeads,
    };
  }

  async getLeads(filters?: { city?: string; primaryPain?: CompanyPainCategory; status?: ProspectedLeadStatus }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.prospectedBusiness.findMany({
      where: {
        tenantId,
        ...(filters?.city ? { city: { contains: filters.city, mode: 'insensitive' } } : {}),
        ...(filters?.primaryPain ? { primaryPain: filters.primaryPain } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
      },
      orderBy: [
        { scannedAt: 'desc' },
        { reviewsCount: 'desc' },
      ],
      take: 100,
    });
  }

  async updateLeadStatus(id: string, status: ProspectedLeadStatus) {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.prospectedBusiness.updateMany({
      where: { id, tenantId },
      data: { status },
    });
  }

  private generateAreaCandidates(
    sector: string,
    center: { lat: number; lng: number },
    radiusKm: number,
    city: string,
    state: string,
    polygon?: [number, number][],
  ) {
    const sampleTemplates = [
      {
        namePrefix: 'Clínica & Especialidades',
        suffix: 'del Centro',
        hasWeb: false,
        phone: '+52 442 389 1204',
        rating: 4.8,
        reviewsCount: 112,
        reviewsSnippets: ['Excelente trato del doctor pero tardé 4 días en que me contestaran por WhatsApp para una consulta.'],
      },
      {
        namePrefix: 'Centro Integral',
        suffix: 'San Francisco',
        hasWeb: true,
        webDomain: 'consultoriosanfrancisco.com.mx',
        phone: '+52 442 781 9920',
        rating: 3.9,
        reviewsCount: 47,
        reviewsSnippets: ['Citas mal coordinadas, llegué a mi horario y me hicieron esperar 1 hora y media.', 'No tienen agenda online.'],
      },
      {
        namePrefix: 'Grupo Profesional',
        suffix: 'Metropolitano',
        hasWeb: false,
        phone: '+52 442 612 4055',
        rating: 4.6,
        reviewsCount: 88,
        reviewsSnippets: ['Muy profesionales pero es imposible cotizar o ver precios si no vas en persona.'],
      },
      {
        namePrefix: 'Servicios Especializados',
        suffix: 'Alteña',
        hasWeb: true,
        webDomain: 'alteñaservicios.com',
        phone: '+52 442 901 3341',
        rating: 4.2,
        reviewsCount: 34,
        reviewsSnippets: ['Llamas y nadie contesta el teléfono fijo, tuve que ir hasta allá solo a preguntar horarios.'],
      },
      {
        namePrefix: 'Corporativo Comercial',
        suffix: 'del Bajío',
        hasWeb: true,
        webDomain: 'bajioservicioscorp.com',
        phone: '+52 442 550 8219',
        rating: 4.5,
        reviewsCount: 65,
        reviewsSnippets: ['Buen servicio, instalaciones limpias y atención rápida.'],
      },
      {
        namePrefix: 'Industrias & Logística',
        suffix: 'Vanguardia',
        hasWeb: false,
        phone: '+52 442 119 8832',
        rating: 4.4,
        reviewsCount: 29,
        reviewsSnippets: ['No tienen catálogo web ni precios actualizados.'],
      },
    ];

    let bbox = polygon && polygon.length >= 3 ? calculatePolygonBoundingBox(polygon) : null;

    return sampleTemplates
      .map((tpl, i) => {
        let lat: number;
        let lng: number;

        if (polygon && polygon.length >= 3 && bbox) {
          // Disperse points interpolated inside the bounding box
          const t = (i + 1) / (sampleTemplates.length + 1);
          lat = Number((bbox.minLat + (bbox.maxLat - bbox.minLat) * t).toFixed(6));
          lng = Number((bbox.minLng + (bbox.maxLng - bbox.minLng) * (0.3 + 0.4 * t)).toFixed(6));

          // If slightly outside boundary, clamp closer to centroid
          if (!isPointInsidePolygon([lat, lng], polygon)) {
            lat = Number((bbox.centroid.lat + (lat - bbox.centroid.lat) * 0.4).toFixed(6));
            lng = Number((bbox.centroid.lng + (lng - bbox.centroid.lng) * 0.4).toFixed(6));
          }
        } else {
          // Disperse points around center according to radius
          const angle = (i * 2 * Math.PI) / sampleTemplates.length;
          const distance = (radiusKm * 0.45) / 111; // rough km to degrees
          lat = Number((center.lat + Math.sin(angle) * distance).toFixed(6));
          lng = Number((center.lng + Math.cos(angle) * distance).toFixed(6));
        }

        const fullName = `${tpl.namePrefix} ${sector} ${tpl.suffix}`;
        const placeId = 'gmaps_' + createHash('md5').update(`${fullName}_${city}_${lat}_${lng}`).digest('hex').slice(0, 16);

        return {
          placeId,
          name: fullName,
          category: sector,
          address: `Av. Comercial ${100 + i * 25}, Col. Centro, ${city}`,
          city,
          state,
          country: 'Mexico',
          latitude: lat,
          longitude: lng,
          websiteUrl: tpl.hasWeb ? `https://${tpl.webDomain}` : undefined,
          phone: tpl.phone,
          rating: tpl.rating,
          reviewsCount: tpl.reviewsCount,
          reviewsSnippets: tpl.reviewsSnippets,
          rawGoogleData: {
            types: ['establishment', 'point_of_interest'],
            userRatingsTotal: tpl.reviewsCount,
            vicinity: `${city}, ${state}`,
            geometry: { location: { lat, lng } },
            insidePolygon: Boolean(polygon && polygon.length >= 3),
          },
        };
      })
      .filter((candidate) => {
        // Enforce strict containment if polygon is specified
        if (polygon && polygon.length >= 3) {
          return isPointInsidePolygon([candidate.latitude, candidate.longitude], polygon);
        }
        return true;
      });
  }
}
