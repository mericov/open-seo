const LEAD_CATEGORY_GROUP_NAMES = [
  "health",
  "legal_finance",
  "beauty",
  "home_services",
  "real_estate",
  "food",
  "fitness",
  "auto",
  "events",
  "education",
  "retail",
] as const;

type LeadCategoryGroupName = (typeof LEAD_CATEGORY_GROUP_NAMES)[number];

const LEAD_CATEGORY_GROUPS: Record<LeadCategoryGroupName, readonly string[]> = {
  health: [
    "dentist",
    "dental_clinic",
    "medical_spa",
    "plastic_surgeon",
    "cosmetic_surgeon",
    "dermatologist",
    "chiropractor",
    "physiotherapist",
    "psychologist",
    "veterinarian",
  ],
  legal_finance: [
    "lawyer",
    "law_firm",
    "legal_services",
    "accountant",
    "financial_consultant",
    "financial_planner",
    "insurance_agency",
    "mortgage_broker",
    "mortgage_lender",
  ],
  beauty: [
    "beauty_salon",
    "hair_salon",
    "nail_salon",
    "barber_shop",
    "spa",
    "day_spa",
    "facial_spa",
    "massage_spa",
    "tattoo_shop",
  ],
  home_services: [
    "general_contractor",
    "roofing_contractor",
    "hvac_contractor",
    "plumber",
    "electrician",
    "renovation_contractor",
    "flooring_contractor",
    "landscaper",
    "painter",
    "swimming_pool_contractor",
  ],
  real_estate: [
    "real_estate_agency",
    "real_estate_agents",
    "real_estate_consultant",
    "property_management_company",
    "home_builder",
    "interior_designer",
    "architect",
  ],
  food: [
    "restaurant",
    "cafe",
    "coffee_shop",
    "bakery",
    "catering_service",
    "bar",
    "pizza_restaurant",
  ],
  fitness: [
    "gym",
    "yoga_studio",
    "pilates_studio",
    "personal_trainer",
    "martial_arts_school",
    "dance_school",
    "sports_club",
  ],
  auto: [
    "auto_repair_shop",
    "auto_body_shop",
    "car_dealer",
    "used_car_dealer",
    "car_wash",
    "tire_shop",
    "car_rental_agency",
  ],
  events: [
    "wedding_venue",
    "wedding_planner",
    "event_planner",
    "wedding_photographer",
    "photographer",
    "florist",
    "event_venue",
  ],
  education: [
    "language_school",
    "english_language_school",
    "driving_school",
    "music_school",
    "preschool",
    "art_school",
  ],
  retail: [
    "clothing_store",
    "boutique",
    "jewelry_store",
    "furniture_store",
    "gift_shop",
    "cosmetics_store",
    "home_goods_store",
  ],
};

export const LEAD_CATEGORY_GROUP_KEYS = [
  "all",
  ...LEAD_CATEGORY_GROUP_NAMES,
] as const;

export type LeadCategoryGroup = (typeof LEAD_CATEGORY_GROUP_KEYS)[number];

export const LEAD_NEED_FILTERS = [
  "no_website",
  "unclaimed",
  "few_reviews",
] as const;

export type LeadNeedFilter = (typeof LEAD_NEED_FILTERS)[number];

export const FEW_REVIEWS_THRESHOLD = 10;

export const LEAD_STORE_PLATFORMS = [
  "Shopify",
  "WooCommerce",
  "Wix",
  "Squarespace",
  "BigCommerce",
] as const;

export type LeadStorePlatform = (typeof LEAD_STORE_PLATFORMS)[number];

export const LEAD_RUN_SIZE_MAX = 50;
export const LEAD_AUTO_RUN_INTERVAL_DAYS = 7;

export function categoriesForSearch(search: {
  category: string;
  categoryGroup: string | null;
}): string[] | undefined {
  if (!search.categoryGroup) return [search.category];
  const group = LEAD_CATEGORY_GROUP_NAMES.find(
    (name) => name === search.categoryGroup,
  );
  return group ? [...LEAD_CATEGORY_GROUPS[group]] : undefined;
}
