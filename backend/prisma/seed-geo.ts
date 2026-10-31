import { PrismaClient } from '@prisma/client';
import { City, State } from 'country-state-city';

const prisma = new PrismaClient();

// Tactical polygon presets for high-value business corridors
interface TacticalPolygonSeed {
  slug: string;
  countryCode: string;
  countryName: string;
  flag: string;
  state: string;
  stateCode: string;
  city: string;
  category: string;
  centroid: [number, number]; // [lat, lng]
  polygon: [number, number][];
}

const TACTICAL_POLYGONS: TacticalPolygonSeed[] = [
  // --- MEXICO ---
  {
    slug: 'mx-yuc-merida-industrial-progreso',
    countryCode: 'MX',
    countryName: 'Mexico',
    flag: '🇲🇽',
    state: 'Yucatán',
    stateCode: 'YUC',
    city: 'Corredor Industrial Mérida - Progreso',
    category: 'Industrial',
    centroid: [21.0325, -89.6225],
    polygon: [
      [21.0100, -89.6500],
      [21.0550, -89.6500],
      [21.0550, -89.5950],
      [21.0100, -89.5950],
    ],
  },
  {
    slug: 'mx-yuc-merida-montejo-hotelera',
    countryCode: 'MX',
    countryName: 'Mexico',
    flag: '🇲🇽',
    state: 'Yucatán',
    stateCode: 'YUC',
    city: 'Paseo de Montejo & Zona Hotelera',
    category: 'Comercial',
    centroid: [20.9950, -89.6190],
    polygon: [
      [20.9750, -89.6230],
      [21.0150, -89.6150],
      [21.0150, -89.6230],
      [20.9750, -89.6150],
    ],
  },
  {
    slug: 'mx-que-queretaro-industrial-park',
    countryCode: 'MX',
    countryName: 'Mexico',
    flag: '🇲🇽',
    state: 'Querétaro',
    stateCode: 'QUE',
    city: 'Parque Industrial Querétaro & 5 de Febrero',
    category: 'Industrial',
    centroid: [20.6500, -100.4350],
    polygon: [
      [20.5900, -100.4600],
      [20.7100, -100.4600],
      [20.7100, -100.4100],
      [20.5900, -100.4100],
    ],
  },
  {
    slug: 'mx-jal-guadalajara-zapopan-tech',
    countryCode: 'MX',
    countryName: 'Mexico',
    flag: '🇲🇽',
    state: 'Jalisco',
    stateCode: 'JAL',
    city: 'Corredor Financiero & Tech Andares / Puerta de Hierro',
    category: 'Financiero',
    centroid: [20.7090, -103.4150],
    polygon: [
      [20.6950, -103.4300],
      [20.7250, -103.4300],
      [20.7250, -103.4000],
      [20.6950, -103.4000],
    ],
  },
  {
    slug: 'mx-cmx-cdmx-reforma-polanco',
    countryCode: 'MX',
    countryName: 'Mexico',
    flag: '🇲🇽',
    state: 'Ciudad de México',
    stateCode: 'CMX',
    city: 'Corredor Financiero Paseo de la Reforma & Polanco',
    category: 'Financiero',
    centroid: [19.4300, -100.4350],
    polygon: [
      [19.4200, -99.2100],
      [19.4450, -99.2100],
      [19.4450, -99.1600],
      [19.4200, -99.1600],
    ],
  },
  {
    slug: 'mx-nle-monterrey-san-pedro',
    countryCode: 'MX',
    countryName: 'Mexico',
    flag: '🇲🇽',
    state: 'Nuevo León',
    stateCode: 'NLE',
    city: 'San Pedro Garza García - Valle Oriente Corporate Hub',
    category: 'Financiero',
    centroid: [25.6550, -100.3450],
    polygon: [
      [25.6350, -100.3700],
      [25.6750, -100.3700],
      [25.6750, -100.3200],
      [25.6350, -100.3200],
    ],
  },

  // --- COLOMBIA ---
  {
    slug: 'co-ant-medellin-poblado-milla-oro',
    countryCode: 'CO',
    countryName: 'Colombia',
    flag: '🇨🇴',
    state: 'Antioquia',
    stateCode: 'ANT',
    city: 'El Poblado & Milla de Oro Tech/Financial District',
    category: 'Financiero',
    centroid: [6.2085, -75.5680],
    polygon: [
      [6.1950, -75.5780],
      [6.2220, -75.5780],
      [6.2220, -75.5580],
      [6.1950, -75.5580],
    ],
  },
  {
    slug: 'co-bog-bogota-chico-93',
    countryCode: 'CO',
    countryName: 'Colombia',
    flag: '🇨🇴',
    state: 'Bogotá D.C.',
    stateCode: 'DC',
    city: 'Chicó Norte, Parque de la 93 & Zona T',
    category: 'Comercial',
    centroid: [4.6750, -74.0530],
    polygon: [
      [4.6600, -74.0620],
      [4.6900, -74.0620],
      [4.6900, -74.0440],
      [4.6600, -74.0440],
    ],
  },
  {
    slug: 'co-san-bucaramanga-cabecera',
    countryCode: 'CO',
    countryName: 'Colombia',
    flag: '🇨🇴',
    state: 'Santander',
    stateCode: 'SAN',
    city: 'Cabecera del Llano & Corredor Comercial Cra 33',
    category: 'Comercial',
    centroid: [7.1180, -73.1110],
    polygon: [
      [7.1050, -73.1200],
      [7.1310, -73.1200],
      [7.1310, -73.1020],
      [7.1050, -73.1020],
    ],
  },

  // --- UNITED STATES ---
  {
    slug: 'us-ca-sf-soma-ai-hub',
    countryCode: 'US',
    countryName: 'United States',
    flag: '🇺🇸',
    state: 'California',
    stateCode: 'CA',
    city: 'SoMa & Mission Bay - The AI & VC Capital',
    category: 'Tech',
    centroid: [37.7785, -122.3980],
    polygon: [
      [37.7650, -122.4150],
      [37.7920, -122.4150],
      [37.7920, -122.3810],
      [37.7650, -122.3810],
    ],
  },
  {
    slug: 'us-ca-palo-alto-sand-hill-vc',
    countryCode: 'US',
    countryName: 'United States',
    flag: '🇺🇸',
    state: 'California',
    stateCode: 'CA',
    city: 'Sand Hill Road & Stanford Research Park',
    category: 'Tech',
    centroid: [37.4250, -122.1800],
    polygon: [
      [37.4050, -122.2050],
      [37.4450, -122.2050],
      [37.4450, -122.1550],
      [37.4050, -122.1550],
    ],
  },
  {
    slug: 'us-ca-la-silicon-beach',
    countryCode: 'US',
    countryName: 'United States',
    flag: '🇺🇸',
    state: 'California',
    stateCode: 'CA',
    city: 'Silicon Beach (Santa Monica, Venice & Playa Vista)',
    category: 'Tech',
    centroid: [34.0050, -118.4550],
    polygon: [
      [33.9700, -118.4950],
      [34.0400, -118.4950],
      [34.0400, -118.4150],
      [33.9700, -118.4150],
    ],
  },
  {
    slug: 'us-tx-austin-downtown-domain',
    countryCode: 'US',
    countryName: 'United States',
    flag: '🇺🇸',
    state: 'Texas',
    stateCode: 'TX',
    city: 'Silicon Hills (Downtown & The Domain)',
    category: 'Tech',
    centroid: [30.3000, -97.7400],
    polygon: [
      [30.2500, -97.7700],
      [30.4100, -97.7700],
      [30.4100, -97.7100],
      [30.2500, -97.7100],
    ],
  },
];

const TARGET_REGIONS: Array<{ countryCode: string; countryName: string; flag: string; states: string[] }> = [
  {
    countryCode: 'MX',
    countryName: 'Mexico',
    flag: '🇲🇽',
    states: ['Yucatán', 'Querétaro', 'Jalisco', 'Ciudad de México', 'Nuevo León', 'Quintana Roo', 'Puebla', 'Guanajuato'],
  },
  {
    countryCode: 'CO',
    countryName: 'Colombia',
    flag: '🇨🇴',
    states: ['Bogotá D.C.', 'Cundinamarca', 'Antioquia', 'Santander', 'Valle del Cauca', 'Atlántico', 'Bolívar'],
  },
  {
    countryCode: 'US',
    countryName: 'United States',
    flag: '🇺🇸',
    states: ['California', 'Texas', 'Florida', 'New York', 'Illinois', 'Washington', 'Massachusetts', 'Colorado'],
  },
];

export async function seedGeoPresets(): Promise<{ tacticalCount: number; citiesCount: number }> {
  console.log('🚀 Seeding GeoPresets (High-Speed Batch Mode)...');

  // 1. Seed Tactical Polygons
  for (const poly of TACTICAL_POLYGONS) {
    await prisma.geoPreset.upsert({
      where: { slug: poly.slug },
      update: {
        category: poly.category,
        latitude: poly.centroid[0],
        longitude: poly.centroid[1],
        polygonCoordinates: poly.polygon,
        isTactical: true,
      },
      create: {
        slug: poly.slug,
        countryCode: poly.countryCode,
        countryName: poly.countryName,
        flag: poly.flag,
        state: poly.state,
        stateCode: poly.stateCode,
        city: poly.city,
        latitude: poly.centroid[0],
        longitude: poly.centroid[1],
        zoom: 14,
        isTactical: true,
        category: poly.category,
        polygonCoordinates: poly.polygon,
      },
    });
  }
  console.log(`✅ Seeded ${TACTICAL_POLYGONS.length} tactical polygons.`);

  // 2. Extract and Prepare Cities in Memory
  interface GeoPresetInsertItem {
    slug: string;
    countryCode: string;
    countryName: string;
    flag: string;
    state: string;
    stateCode: string | null;
    city: string;
    latitude: number;
    longitude: number;
    zoom: number;
    isTactical: boolean;
    category: string;
  }

  const itemsToInsert: GeoPresetInsertItem[] = [];
  const slugSet = new Set<string>();

  // Add tactical slugs so cities don't conflict
  TACTICAL_POLYGONS.forEach((p) => slugSet.add(p.slug));

  for (const region of TARGET_REGIONS) {
    const statesInCountry = State.getStatesOfCountry(region.countryCode);

    for (const targetStateName of region.states) {
      const matchedState = statesInCountry.find(
        (s) =>
          s.name.toLowerCase() === targetStateName.toLowerCase() ||
          s.name.toLowerCase().includes(targetStateName.toLowerCase()) ||
          targetStateName.toLowerCase().includes(s.name.toLowerCase())
      );

      if (!matchedState) {
        console.warn(`⚠️ State not found in country-state-city: ${targetStateName} (${region.countryCode})`);
        continue;
      }

      const cities = City.getCitiesOfState(region.countryCode, matchedState.isoCode);

      for (const city of cities) {
        if (!city.latitude || !city.longitude) continue;

        let baseSlug = `${region.countryCode.toLowerCase()}-${matchedState.isoCode.toLowerCase()}-${city.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')}`;

        let slug = baseSlug;
        let counter = 1;
        while (slugSet.has(slug)) {
          slug = `${baseSlug}-${counter++}`;
        }
        slugSet.add(slug);

        itemsToInsert.push({
          slug,
          countryCode: region.countryCode,
          countryName: region.countryName,
          flag: region.flag,
          state: matchedState.name,
          stateCode: matchedState.isoCode,
          city: city.name,
          latitude: parseFloat(city.latitude),
          longitude: parseFloat(city.longitude),
          zoom: 13,
          isTactical: false,
          category: 'Metropolitan Area',
        });
      }
    }
  }

  console.log(`📦 Prepared ${itemsToInsert.length} cities. Inserting via high-speed createMany...`);

  // Batch insert chunks of 500 records with skipDuplicates for high performance in production (1-2 seconds)
  const BATCH_SIZE = 500;
  for (let i = 0; i < itemsToInsert.length; i += BATCH_SIZE) {
    const chunk = itemsToInsert.slice(i, i + BATCH_SIZE);
    await prisma.geoPreset.createMany({
      data: chunk,
      skipDuplicates: true,
    });
  }

  console.log(`✅ High-speed seed completed: ${itemsToInsert.length} cities inserted.`);
  return { tacticalCount: TACTICAL_POLYGONS.length, citiesCount: itemsToInsert.length };
}

// Allow direct execution via CLI
if (require.main === module) {
  seedGeoPresets()
    .then(({ tacticalCount, citiesCount }) => {
      console.log(`🎉 Production Seed Summary: ${tacticalCount} Polygons | ${citiesCount} Cities ready.`);
    })
    .catch((e) => {
      console.error('❌ Error during GeoPreset seed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
