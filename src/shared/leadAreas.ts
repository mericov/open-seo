// Metro areas a country-wide local campaign walks through, largest first. Each
// one is searched as a circle around its center, so a campaign covers a whole
// country without the user picking cities.

type LeadArea = {
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
};

// [code, name, latitude, longitude, radius in km]
type AreaRow = [string, string, number, number, number];

const US_AREAS: AreaRow[] = [
  ["us-new-york", "New York, NY", 40.7128, -74.006, 50],
  ["us-los-angeles", "Los Angeles, CA", 34.0522, -118.2437, 50],
  ["us-chicago", "Chicago, IL", 41.8781, -87.6298, 50],
  ["us-dallas", "Dallas–Fort Worth, TX", 32.8, -97.0, 50],
  ["us-houston", "Houston, TX", 29.7604, -95.3698, 50],
  ["us-washington", "Washington, DC", 38.9072, -77.0369, 45],
  ["us-philadelphia", "Philadelphia, PA", 39.9526, -75.1652, 45],
  ["us-miami", "Miami, FL", 25.95, -80.2, 50],
  ["us-atlanta", "Atlanta, GA", 33.749, -84.388, 50],
  ["us-boston", "Boston, MA", 42.3601, -71.0589, 45],
  ["us-phoenix", "Phoenix, AZ", 33.4484, -112.074, 50],
  ["us-san-francisco", "San Francisco Bay Area, CA", 37.7749, -122.4194, 45],
  ["us-riverside", "Riverside–San Bernardino, CA", 34.0, -117.35, 45],
  ["us-detroit", "Detroit, MI", 42.3314, -83.0458, 45],
  ["us-seattle", "Seattle, WA", 47.6062, -122.3321, 45],
  ["us-minneapolis", "Minneapolis–St. Paul, MN", 44.9778, -93.265, 45],
  ["us-san-diego", "San Diego, CA", 32.7157, -117.1611, 40],
  ["us-tampa", "Tampa, FL", 27.9506, -82.4572, 45],
  ["us-denver", "Denver, CO", 39.7392, -104.9903, 45],
  ["us-baltimore", "Baltimore, MD", 39.2904, -76.6122, 35],
  ["us-st-louis", "St. Louis, MO", 38.627, -90.1994, 45],
  ["us-orlando", "Orlando, FL", 28.5383, -81.3792, 45],
  ["us-charlotte", "Charlotte, NC", 35.2271, -80.8431, 45],
  ["us-san-antonio", "San Antonio, TX", 29.4241, -98.4936, 40],
  ["us-portland", "Portland, OR", 45.5152, -122.6784, 40],
  ["us-sacramento", "Sacramento, CA", 38.5816, -121.4944, 40],
  ["us-pittsburgh", "Pittsburgh, PA", 40.4406, -79.9959, 40],
  ["us-austin", "Austin, TX", 30.2672, -97.7431, 45],
  ["us-las-vegas", "Las Vegas, NV", 36.1699, -115.1398, 40],
  ["us-cincinnati", "Cincinnati, OH", 39.1031, -84.512, 40],
  ["us-kansas-city", "Kansas City, MO", 39.0997, -94.5786, 40],
  ["us-columbus", "Columbus, OH", 39.9612, -82.9988, 40],
  ["us-indianapolis", "Indianapolis, IN", 39.7684, -86.1581, 40],
  ["us-cleveland", "Cleveland, OH", 41.4993, -81.6944, 40],
  ["us-san-jose", "San Jose, CA", 37.3382, -121.8863, 30],
  ["us-nashville", "Nashville, TN", 36.1627, -86.7816, 45],
  ["us-virginia-beach", "Virginia Beach–Norfolk, VA", 36.85, -76.2, 40],
  ["us-providence", "Providence, RI", 41.824, -71.4128, 35],
  ["us-jacksonville", "Jacksonville, FL", 30.3322, -81.6557, 40],
  ["us-milwaukee", "Milwaukee, WI", 43.0389, -87.9065, 35],
  ["us-raleigh", "Raleigh–Durham, NC", 35.85, -78.8, 40],
  ["us-oklahoma-city", "Oklahoma City, OK", 35.4676, -97.5164, 40],
  ["us-memphis", "Memphis, TN", 35.1495, -90.049, 35],
  ["us-richmond", "Richmond, VA", 37.5407, -77.436, 35],
  ["us-louisville", "Louisville, KY", 38.2527, -85.7585, 35],
  ["us-salt-lake-city", "Salt Lake City, UT", 40.7608, -111.891, 40],
  ["us-new-orleans", "New Orleans, LA", 29.9511, -90.0715, 35],
  ["us-hartford", "Hartford, CT", 41.7658, -72.6734, 35],
  ["us-buffalo", "Buffalo, NY", 42.8864, -78.8784, 35],
  ["us-birmingham", "Birmingham, AL", 33.5186, -86.8104, 35],
  ["us-rochester", "Rochester, NY", 43.1566, -77.6088, 30],
  ["us-grand-rapids", "Grand Rapids, MI", 42.9634, -85.6681, 35],
  ["us-tucson", "Tucson, AZ", 32.2226, -110.9747, 35],
  ["us-honolulu", "Honolulu, HI", 21.3069, -157.8583, 30],
  ["us-tulsa", "Tulsa, OK", 36.154, -95.9928, 35],
  ["us-fresno", "Fresno, CA", 36.7378, -119.7871, 35],
  ["us-omaha", "Omaha, NE", 41.2565, -95.9345, 35],
  ["us-albuquerque", "Albuquerque, NM", 35.0844, -106.6504, 35],
  ["us-bridgeport", "Bridgeport–Stamford, CT", 41.15, -73.35, 30],
  ["us-charleston", "Charleston, SC", 32.7765, -79.9311, 35],
  ["us-greenville", "Greenville, SC", 34.8526, -82.394, 35],
  ["us-boise", "Boise, ID", 43.615, -116.2023, 35],
  ["us-knoxville", "Knoxville, TN", 35.9606, -83.9207, 35],
  ["us-el-paso", "El Paso, TX", 31.7619, -106.485, 30],
  ["us-sarasota", "Sarasota, FL", 27.3364, -82.5307, 30],
  ["us-naples", "Naples, FL", 26.142, -81.7948, 30],
  ["us-scottsdale", "Scottsdale, AZ", 33.4942, -111.9261, 20],
  ["us-palm-beach", "Palm Beach, FL", 26.7056, -80.0364, 30],
];

const TR_AREAS: AreaRow[] = [
  ["tr-istanbul-avrupa", "İstanbul (Avrupa)", 41.04, 28.9, 30],
  ["tr-istanbul-anadolu", "İstanbul (Anadolu)", 40.99, 29.15, 30],
  ["tr-ankara", "Ankara", 39.9334, 32.8597, 35],
  ["tr-izmir", "İzmir", 38.4237, 27.1428, 35],
  ["tr-bursa", "Bursa", 40.1885, 29.061, 30],
  ["tr-antalya", "Antalya", 36.8969, 30.7133, 35],
  ["tr-kocaeli", "Kocaeli", 40.7654, 29.9408, 30],
  ["tr-konya", "Konya", 37.8746, 32.4932, 30],
  ["tr-adana", "Adana", 37.0, 35.3213, 30],
  ["tr-gaziantep", "Gaziantep", 37.0662, 37.3833, 30],
  ["tr-mersin", "Mersin", 36.8121, 34.6415, 30],
  ["tr-kayseri", "Kayseri", 38.7205, 35.4826, 30],
  ["tr-eskisehir", "Eskişehir", 39.7767, 30.5206, 25],
  ["tr-mugla-bodrum", "Bodrum, Muğla", 37.0344, 27.4305, 25],
  ["tr-denizli", "Denizli", 37.7765, 29.0864, 25],
  ["tr-samsun", "Samsun", 41.2867, 36.33, 25],
  ["tr-tekirdag", "Tekirdağ", 40.978, 27.511, 25],
  ["tr-sakarya", "Sakarya", 40.7569, 30.3781, 25],
  ["tr-trabzon", "Trabzon", 41.0015, 39.7178, 25],
  ["tr-diyarbakir", "Diyarbakır", 37.9144, 40.2306, 25],
];

const toArea = ([code, name, latitude, longitude, radiusKm]: AreaRow) => ({
  code,
  name,
  latitude,
  longitude,
  radiusKm,
});

export const LEAD_AREA_COUNTRIES = ["US", "TR"] as const;

export type LeadAreaCountry = (typeof LEAD_AREA_COUNTRIES)[number];

export function leadAreasFor(countryCode: string | null): LeadArea[] {
  if (countryCode === "US") return US_AREAS.map(toArea);
  if (countryCode === "TR") return TR_AREAS.map(toArea);
  return [];
}

// How far a country-wide campaign has walked through its areas.
export function areaProgress(
  countryCode: string | null,
  rows: { areaCode: string; exhaustedAt: string | null }[],
) {
  const areas = leadAreasFor(countryCode);
  if (areas.length === 0) return null;
  const exhausted = new Set(
    rows.filter((row) => row.exhaustedAt).map((row) => row.areaCode),
  );
  return {
    total: areas.length,
    done: exhausted.size,
    next: areas.find((area) => !exhausted.has(area.code))?.name ?? null,
  };
}
