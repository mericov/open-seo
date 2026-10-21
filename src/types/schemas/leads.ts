import { z } from "zod";

const projectIdShape = { projectId: z.string().min(1) };

export const LEAD_SEARCH_MAX_LIMIT = 100;

export const leadCategoryQuerySchema = z.object({
  ...projectIdShape,
  query: z.string().trim().max(80).optional(),
});

export const leadLocationQuerySchema = z.object({
  ...projectIdShape,
  query: z.string().trim().min(2).max(200),
});

export const startLeadSearchSchema = z.object({
  ...projectIdShape,
  category: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9_]+$/, "Pick a category from the list."),
  nameQuery: z.string().trim().max(120).optional(),
  location: z.string().trim().min(2).max(200),
  place: z
    .object({
      label: z.string().trim().min(1).max(300),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
  radiusKm: z.number().int().min(1).max(100),
  limit: z.number().int().min(1).max(LEAD_SEARCH_MAX_LIMIT),
  minRating: z.number().min(1).max(5).optional(),
});

export const leadSearchIdSchema = z.object({
  ...projectIdShape,
  searchId: z.string().min(1),
});

export const listLeadSearchesSchema = z.object(projectIdShape);
