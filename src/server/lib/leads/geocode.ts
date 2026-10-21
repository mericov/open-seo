import { z } from "zod";
import { AppError } from "@/server/lib/errors";

const PHOTON_URL = "https://photon.komoot.io/api/";
const PLACE_LAYERS = ["city", "district", "locality", "county", "state"];
const MAX_CANDIDATES = 5;

const featureSchema = z.object({
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
  properties: z.object({
    name: z.string().optional(),
    city: z.string().optional(),
    county: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
  }),
});
const responseSchema = z.object({ features: z.array(z.unknown()) });

type GeocodedPlace = {
  latitude: number;
  longitude: number;
  label: string;
};

export async function findPlaces(query: string): Promise<GeocodedPlace[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(MAX_CANDIDATES),
  });
  for (const layer of PLACE_LAYERS) params.append("layer", layer);

  let body: unknown;
  try {
    const response = await fetch(`${PHOTON_URL}?${params}`, {
      headers: {
        "User-Agent": "MericSEO-LeadFinder/1.0 (https://seo.mericozyon.com)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) throw new Error(`Photon ${response.status}`);
    body = await response.json();
  } catch {
    throw new AppError("LEAD_LOCATION_NOT_FOUND");
  }

  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) return [];
  const places: GeocodedPlace[] = [];
  for (const raw of parsed.data.features) {
    const feature = featureSchema.safeParse(raw);
    if (!feature.success) continue;
    const [longitude, latitude] = feature.data.geometry.coordinates;
    const { name, city, county, state, country } = feature.data.properties;
    const parts = [name, city, county, state, country].filter(
      (part, index, all): part is string =>
        Boolean(part) && all.indexOf(part) === index,
    );
    const label = parts.join(", ");
    if (!label || places.some((place) => place.label === label)) continue;
    places.push({ latitude, longitude, label });
  }
  return places;
}
