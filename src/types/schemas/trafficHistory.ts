import { z } from "zod";
import { TRAFFIC_EXTEND_RANGES } from "@/shared/trafficHistory";

const marketShape = {
  projectId: z.string().min(1),
  domain: z.string().min(1).max(2048),
  locationCode: z.number().int().positive().optional(),
};

export const trafficHistoryMarketSchema = z.object(marketShape);

export const extendTrafficHistorySchema = z.object({
  ...marketShape,
  range: z.enum(TRAFFIC_EXTEND_RANGES),
});

export const addTrafficNoteSchema = z.object({
  ...marketShape,
  month: z.string().regex(/^\d{4}-\d{2}$/),
  body: z.string().trim().min(1).max(500),
});

export const deleteTrafficNoteSchema = z.object({
  ...marketShape,
  noteId: z.string().min(1),
});
