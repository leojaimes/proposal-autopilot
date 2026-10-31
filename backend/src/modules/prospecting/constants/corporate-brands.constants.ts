export interface CorporateBrandSeedItem {
  slug: string;
  name: string;
  rootDomain: string;
  industry: string;
  countryScope: string[];
  headquartersCity: string;
}

export const KNOWN_CORPORATE_BRANDS: CorporateBrandSeedItem[] = [
  // Healthcare, Dental & Labs (MX, CO, US)
  { slug: 'dentalia', name: 'Dentalia', rootDomain: 'dentalia.com', industry: 'Dental & Healthcare', countryScope: ['MX'], headquartersCity: 'Ciudad de México' },
  { slug: 'salud-digna', name: 'Salud Digna', rootDomain: 'salud-digna.org', industry: 'Diagnostics & Healthcare', countryScope: ['MX'], headquartersCity: 'Culiacán' },
  { slug: 'laboratorio-medico-del-chopo', name: 'Laboratorio Médico del Chopo', rootDomain: 'chopo.com.mx', industry: 'Diagnostics & Healthcare', countryScope: ['MX'], headquartersCity: 'Ciudad de México' },
  { slug: 'laboratorios-jenner', name: 'Laboratorios Jenner', rootDomain: 'jenner.com.mx', industry: 'Diagnostics & Healthcare', countryScope: ['MX'], headquartersCity: 'Ciudad de México' },
  { slug: 'laboratorio-olarte-y-akle', name: 'Olarte y Akle', rootDomain: 'olarteyakle.mx', industry: 'Diagnostics & Healthcare', countryScope: ['MX'], headquartersCity: 'Ciudad de México' },
  { slug: 'farmacias-similares', name: 'Farmacias Similares', rootDomain: 'farmaciassimilares.com', industry: 'Pharmacy & Clinics', countryScope: ['MX', 'CO'], headquartersCity: 'Ciudad de México' },
  { slug: 'farmacias-del-ahorro', name: 'Farmacias del Ahorro', rootDomain: 'fahorro.com', industry: 'Pharmacy & Clinics', countryScope: ['MX'], headquartersCity: 'Monterrey' },
  { slug: 'farmacias-guadalajara', name: 'Farmacias Guadalajara', rootDomain: 'farmaciasguadalajara.com', industry: 'Pharmacy & Retail', countryScope: ['MX'], headquartersCity: 'Guadalajara' },
  { slug: 'farmacias-benavides', name: 'Farmacias Benavides', rootDomain: 'benavides.com.mx', industry: 'Pharmacy & Retail', countryScope: ['MX'], headquartersCity: 'Monterrey' },
  { slug: 'farmacias-yza', name: 'Farmacias YZA', rootDomain: 'yza.mx', industry: 'Pharmacy & Retail', countryScope: ['MX'], headquartersCity: 'Mérida' },
  { slug: 'clinicas-sonria', name: 'Clínicas Odontológicas Sonría', rootDomain: 'sonria.com.co', industry: 'Dental & Healthcare', countryScope: ['CO'], headquartersCity: 'Bogotá' },
  { slug: 'dentix-colombia', name: 'Dentix', rootDomain: 'dentix.co', industry: 'Dental & Healthcare', countryScope: ['CO'], headquartersCity: 'Bogotá' },
  { slug: 'droguerias-cruz-verde', name: 'Cruz Verde', rootDomain: 'cruzverde.com.co', industry: 'Pharmacy & Clinics', countryScope: ['CO'], headquartersCity: 'Bogotá' },
  { slug: 'farmatodo', name: 'Farmatodo', rootDomain: 'farmatodo.com.co', industry: 'Pharmacy & Retail', countryScope: ['CO'], headquartersCity: 'Bogotá' },
  { slug: 'locatel-colombia', name: 'Locatel', rootDomain: 'locatelcolombia.com', industry: 'Pharmacy & Healthcare', countryScope: ['CO'], headquartersCity: 'Bogotá' },
  { slug: 'aspen-dental', name: 'Aspen Dental', rootDomain: 'aspendental.com', industry: 'Dental & Healthcare', countryScope: ['US'], headquartersCity: 'Chicago' },
  { slug: 'pacific-dental-services', name: 'Pacific Dental Services', rootDomain: 'pacificdentalservices.com', industry: 'Dental & Healthcare', countryScope: ['US'], headquartersCity: 'Irvine' },
  { slug: 'western-dental', name: 'Western Dental', rootDomain: 'westerndental.com', industry: 'Dental & Healthcare', countryScope: ['US'], headquartersCity: 'Orange' },
  { slug: 'cvs-pharmacy', name: 'CVS Pharmacy', rootDomain: 'cvs.com', industry: 'Pharmacy & Healthcare', countryScope: ['US'], headquartersCity: 'Woonsocket' },
  { slug: 'walgreens', name: 'Walgreens', rootDomain: 'walgreens.com', industry: 'Pharmacy & Healthcare', countryScope: ['US'], headquartersCity: 'Deerfield' },
  { slug: 'quest-diagnostics', name: 'Quest Diagnostics', rootDomain: 'questdiagnostics.com', industry: 'Diagnostics & Healthcare', countryScope: ['US', 'MX'], headquartersCity: 'Secaucus' },
  { slug: 'banfield-pet-hospital', name: 'Banfield Pet Hospital', rootDomain: 'banfield.com', industry: 'Veterinary Clinics', countryScope: ['US', 'MX'], headquartersCity: 'Vancouver' },

  // Food, Beverage & Hospitality Franchises
  { slug: 'starbucks', name: 'Starbucks', rootDomain: 'starbucks.com', industry: 'Food & Beverage', countryScope: ['US', 'MX', 'CO'], headquartersCity: 'Seattle' },
  { slug: 'starbucks-mexico', name: 'Starbucks México', rootDomain: 'starbucks.com.mx', industry: 'Food & Beverage', countryScope: ['MX'], headquartersCity: 'Ciudad de México' },
  { slug: 'juan-valdez-cafe', name: 'Juan Valdez Café', rootDomain: 'juanvaldezcafe.com', industry: 'Food & Beverage', countryScope: ['CO', 'MX', 'US'], headquartersCity: 'Bogotá' },
  { slug: 'crepes-and-waffles', name: 'Crepes & Waffles', rootDomain: 'crepesywaffles.com', industry: 'Restaurants', countryScope: ['CO', 'MX'], headquartersCity: 'Bogotá' },
  { slug: 'dominos-pizza', name: "Domino's Pizza", rootDomain: 'dominos.com', industry: 'Restaurants', countryScope: ['US', 'MX', 'CO'], headquartersCity: 'Ann Arbor' },
  { slug: 'dominos-mexico', name: "Domino's México", rootDomain: 'dominos.com.mx', industry: 'Restaurants', countryScope: ['MX'], headquartersCity: 'Ciudad de México' },
  { slug: 'subway', name: 'Subway', rootDomain: 'subway.com', industry: 'Restaurants', countryScope: ['US', 'MX', 'CO'], headquartersCity: 'Miami' },
  { slug: 'mcdonalds', name: "McDonald's", rootDomain: 'mcdonalds.com', industry: 'Restaurants', countryScope: ['US', 'MX', 'CO'], headquartersCity: 'Chicago' },
  { slug: 'burger-king', name: 'Burger King', rootDomain: 'bk.com', industry: 'Restaurants', countryScope: ['US', 'MX', 'CO'], headquartersCity: 'Miami' },
  { slug: 'vips-mexico', name: 'Vips', rootDomain: 'vips.com.mx', industry: 'Restaurants', countryScope: ['MX'], headquartersCity: 'Ciudad de México' },
  { slug: 'toks', name: 'Restaurantes Toks', rootDomain: 'toks.com.mx', industry: 'Restaurants', countryScope: ['MX'], headquartersCity: 'Ciudad de México' },
  { slug: 'sanborns', name: 'Sanborns', rootDomain: 'sanborns.com.mx', industry: 'Retail & Restaurants', countryScope: ['MX'], headquartersCity: 'Ciudad de México' },

  // Convenience, Retail, Fitness & Automotive Chains
  { slug: 'oxxo', name: 'OXXO', rootDomain: 'oxxo.com', industry: 'Convenience Retail', countryScope: ['MX', 'CO'], headquartersCity: 'Monterrey' },
  { slug: 'seven-eleven', name: '7-Eleven', rootDomain: '7-eleven.com', industry: 'Convenience Retail', countryScope: ['US', 'MX'], headquartersCity: 'Irving' },
  { slug: 'seven-eleven-mexico', name: '7-Eleven México', rootDomain: '7-eleven.com.mx', industry: 'Convenience Retail', countryScope: ['MX'], headquartersCity: 'Monterrey' },
  { slug: 'tiendas-ara', name: 'Tiendas ara', rootDomain: 'aratiendas.com', industry: 'Retail', countryScope: ['CO'], headquartersCity: 'Bogotá' },
  { slug: 'tiendas-d1', name: 'Tiendas D1', rootDomain: 'd1.com.co', industry: 'Retail', countryScope: ['CO'], headquartersCity: 'Bogotá' },
  { slug: 'autozone', name: 'AutoZone', rootDomain: 'autozone.com', industry: 'Automotive', countryScope: ['US', 'MX'], headquartersCity: 'Memphis' },
  { slug: 'autozone-mexico', name: 'AutoZone México', rootDomain: 'autozone.com.mx', industry: 'Automotive', countryScope: ['MX'], headquartersCity: 'Monterrey' },
  { slug: 'steren', name: 'Steren', rootDomain: 'steren.com.mx', industry: 'Electronics Retail', countryScope: ['MX', 'CO'], headquartersCity: 'Ciudad de México' },
  { slug: 'smart-fit', name: 'Smart Fit', rootDomain: 'smartfit.com.mx', industry: 'Fitness & Gyms', countryScope: ['MX', 'CO'], headquartersCity: 'Ciudad de México' },
  { slug: 'planet-fitness', name: 'Planet Fitness', rootDomain: 'planetfitness.com', industry: 'Fitness & Gyms', countryScope: ['US', 'MX'], headquartersCity: 'Hampton' },
  { slug: 'anytime-fitness', name: 'Anytime Fitness', rootDomain: 'anytimefitness.com', industry: 'Fitness & Gyms', countryScope: ['US', 'MX'], headquartersCity: 'Woodbury' },
  { slug: 'opticas-devlyn', name: 'Ópticas Devlyn', rootDomain: 'devlyn.com.mx', industry: 'Optical & Healthcare', countryScope: ['MX'], headquartersCity: 'Ciudad de México' },
  { slug: 'opticas-lux', name: 'Ópticas Lux', rootDomain: 'lux.mx', industry: 'Optical & Healthcare', countryScope: ['MX'], headquartersCity: 'Ciudad de México' },
];

