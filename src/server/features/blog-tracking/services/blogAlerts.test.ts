import { describe, expect, it } from "vitest";
import {
  evaluatePageAlerts,
  lastCompleteWeekStart,
} from "@/server/features/blog-tracking/services/blogAlerts";

const url = "https://shop.com/blogs/news/guide";
const post = { id: "post-1", url, publishedAt: null };
const weekStart = "2026-10-19";

const week = (day: string, clicks: number, position = 8) => ({
  pageKey: "https://shop.com/blogs/news/guide",
  weekStart: day,
  clicks,
  impressions: clicks * 20,
  position,
});

const previousWeeks = ["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21"];
const currentWeeks = ["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"];

const queryRow = (query: string, clicks: number, position: number) => ({
  keys: [query, `https://www.shop.com/blogs/news/guide/`],
  clicks,
  impressions: clicks * 10,
  ctr: 0.1,
  position,
});

function evaluate(
  overrides: Partial<Parameters<typeof evaluatePageAlerts>[0]>,
) {
  return evaluatePageAlerts({
    weekStart,
    posts: [post],
    stats: [],
    currentQueries: [],
    previousQueries: [],
    recentAlertKeys: new Set(),
    ...overrides,
  });
}

describe("lastCompleteWeekStart", () => {
  it("waits for Search Console's data lag before a week counts as complete", () => {
    expect(lastCompleteWeekStart(new Date("2026-10-26T03:00:00Z"))).toBe(
      "2026-10-12",
    );
    expect(lastCompleteWeekStart(new Date("2026-10-28T03:00:00Z"))).toBe(
      "2026-10-19",
    );
  });
});

describe("evaluatePageAlerts", () => {
  it("compares the last four weeks with the four before", () => {
    const alerts = evaluate({
      stats: [
        ...previousWeeks.map((day) => week(day, 20)),
        ...currentWeeks.map((day) => week(day, 5)),
      ],
    });
    expect(alerts).toEqual([
      expect.objectContaining({
        kind: "clicks_drop",
        previousValue: 80,
        currentValue: 20,
      }),
    ]);
  });

  it("flags keywords that brought clicks and fell out of the top 20", () => {
    const alerts = evaluate({
      previousQueries: [queryRow("tote bags", 8, 4), queryRow("rare", 1, 6)],
      currentQueries: [queryRow("tote bags", 0, 31)],
    });
    expect(alerts).toEqual([
      expect.objectContaining({
        kind: "keyword_lost",
        query: "tote bags",
        currentValue: 31,
      }),
    ]);
  });

  it("does not repeat an alert raised in recent weeks", () => {
    const alerts = evaluate({
      stats: previousWeeks.map((day) => week(day, 20)),
      recentAlertKeys: new Set([
        "post-1\nclicks_drop\n",
        "post-1\nno_impressions\n",
      ]),
    });
    expect(alerts).toEqual([]);
  });
});
