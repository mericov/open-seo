import { beforeEach, expect, it, vi } from "vitest";
import { LeadScanService } from "@/server/features/leads/services/LeadScanService";

const mocks = vi.hoisted(() => ({
  businessListings: vi.fn(),
  getSearch: vi.fn(),
  existingBusinessKeys: vi.fn(),
  insertLeads: vi.fn(),
  updateSearch: vi.fn(),
}));

vi.mock("@/server/lib/dataforseo", () => ({
  createDataforseoClient: () => ({
    business: { businessListings: mocks.businessListings },
  }),
}));
vi.mock("@/server/features/leads/repositories/LeadRepository", () => ({
  LeadRepository: {
    getSearch: mocks.getSearch,
    existingBusinessKeys: mocks.existingBusinessKeys,
    insertLeads: mocks.insertLeads,
    updateSearch: mocks.updateSearch,
  },
}));

vi.mock("@/server/features/leads/services/LeadFinderService", () => ({
  LeadFinderService: {},
}));

const listing = (cid: number) => ({ title: `Biz ${cid}`, cid: String(cid) });

beforeEach(() => {
  mocks.getSearch.mockResolvedValue({
    id: "s1",
    projectId: "p1",
    source: "local",
    category: "dentist",
    categoryGroup: null,
    needFilter: "no_website",
    nameQuery: null,
    latitude: 30.2,
    longitude: -97.7,
    radiusKm: 25,
    minRating: null,
    runSize: 10,
    nextOffset: 20,
    skippedDuplicates: 0,
    autoRun: true,
  });
  mocks.existingBusinessKeys.mockResolvedValue(
    new Set(["cid:1", "cid:2", "cid:3", "cid:4", "cid:5", "cid:6"]),
  );
});

it("keeps paging from where the last run stopped until it has enough new leads, then starts over", async () => {
  mocks.businessListings
    .mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) => listing(i + 1)))
    .mockResolvedValueOnce([listing(11), listing(12), listing(13)]);

  const result = await LeadScanService.runNow("p1", "s1", {
    organizationId: "org",
  } as never);

  expect(mocks.businessListings.mock.calls.map(([input]) => input)).toEqual([
    expect.objectContaining({
      categories: ["dentist"],
      filters: [["url", "=", null]],
      limit: 10,
      offset: 20,
    }),
    expect.objectContaining({ limit: 6, offset: 30 }),
  ]);
  expect(result).toEqual({ added: 7 });
  expect(mocks.updateSearch).toHaveBeenCalledWith(
    "p1",
    "s1",
    expect.objectContaining({
      nextOffset: 0,
      skippedDuplicates: 6,
      nextRunAt: expect.any(String),
    }),
  );
});
