import { describe, expect, it } from "vitest";
import { utcToZoned, zonedToUtcIso } from "./socialTime";

describe("social time zones", () => {
  it("converts local wall time to UTC across US daylight saving", () => {
    expect(zonedToUtcIso("2026-07-01", "19:00", "America/New_York")).toBe(
      "2026-07-01T23:00:00.000Z",
    );
    expect(zonedToUtcIso("2026-12-01", "19:00", "America/New_York")).toBe(
      "2026-12-02T00:00:00.000Z",
    );
    expect(zonedToUtcIso("2026-12-01", "19:00", "Europe/Istanbul")).toBe(
      "2026-12-01T16:00:00.000Z",
    );
  });

  it("round-trips back to the local day and time", () => {
    expect(utcToZoned("2026-12-02T00:00:00.000Z", "America/New_York")).toEqual({
      day: "2026-12-01",
      time: "19:00",
    });
  });
});
