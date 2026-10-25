import { expect, it } from "vitest";
import { followUpDueOn } from "@/shared/leadFollowUp";

it("schedules follow-ups in business days, skipping weekends", () => {
  // Thursday 2026-10-22: 3 business days later lands on Tuesday.
  expect(followUpDueOn(1, "2026-10-22T15:30:00.000Z")).toBe("2026-10-27");
  // Tuesday 2026-10-27: 5 business days later lands on the next Tuesday.
  expect(followUpDueOn(2, "2026-10-27T09:00:00.000Z")).toBe("2026-11-03");
});
