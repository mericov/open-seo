import { beforeEach, expect, it, vi } from "vitest";
import { StoreFinderService } from "@/server/features/leads/services/StoreFinderService";

const mocks = vi.hoisted(() => ({
  domainsByTechnology: vi.fn(),
  existingBusinessKeys: vi.fn(),
  createSearch: vi.fn(),
  insertLeads: vi.fn(),
  insertFoundEmails: vi.fn(),
  updateSearch: vi.fn(),
}));

vi.mock("@/server/lib/dataforseo", () => ({
  createDataforseoClient: () => ({
    domainAnalytics: { domainsByTechnology: mocks.domainsByTechnology },
  }),
}));
vi.mock("@/server/features/leads/repositories/LeadRepository", () => ({
  LeadRepository: {
    existingBusinessKeys: mocks.existingBusinessKeys,
    createSearch: mocks.createSearch,
    insertLeads: mocks.insertLeads,
    insertFoundEmails: mocks.insertFoundEmails,
    updateSearch: mocks.updateSearch,
  },
}));

const billing = { organizationId: "org" } as never;

beforeEach(() => {
  mocks.existingBusinessKeys.mockResolvedValue(new Set(["domain:old.com"]));
  mocks.createSearch.mockResolvedValue("search-1");
});

it("looks up Shopify stores by country and size, and keeps the emails the lookup found", async () => {
  mocks.domainsByTechnology.mockResolvedValue([
    {
      domain: "www.Candle.com.tr",
      title: "Candle",
      domain_rank: 120,
      country_iso_code: "tr",
      emails: ["Info@candle.com.tr", "not-an-email"],
    },
    { domain: "old.com", title: "Old" },
  ]);

  const result = await StoreFinderService.startStoreSearch(
    {
      projectId: "p1",
      technology: "Shopify",
      keywords: ["mum"],
      countryCode: "TR",
      maxRank: 300,
      limit: 20,
    },
    billing,
  );

  expect(mocks.domainsByTechnology).toHaveBeenCalledWith(
    expect.objectContaining({
      technologies: ["Shopify"],
      keywords: ["mum"],
      filters: [
        ["country_iso_code", "=", "TR"],
        "and",
        ["domain_rank", "<=", 300],
      ],
      limit: 20,
    }),
  );
  expect(result).toMatchObject({ found: 2, added: 1, skippedDuplicates: 1 });
  const [, , leads] = mocks.insertLeads.mock.calls[0];
  expect(leads).toEqual([
    expect.objectContaining({
      domain: "candle.com.tr",
      website: "https://candle.com.tr/",
      countryCode: "TR",
      domainRank: 120,
    }),
  ]);
  expect(mocks.insertFoundEmails).toHaveBeenCalledWith([
    expect.objectContaining({
      leadId: leads[0].id,
      email: "info@candle.com.tr",
      onOwnDomain: true,
    }),
  ]);
});

it("turns a pasted list into unique store domains without a paid lookup", async () => {
  await StoreFinderService.importStores(
    "p1",
    "https://www.Shop.com/products/x\nshop.com, bar.co.uk old.com nonsense",
  );

  expect(mocks.domainsByTechnology).not.toHaveBeenCalled();
  const [, , leads] = mocks.insertLeads.mock.calls[0];
  expect(leads.map((lead: { domain: string }) => lead.domain)).toEqual([
    "shop.com",
    "bar.co.uk",
  ]);
});

it("searches each keyword on its own so any keyword can match", async () => {
  mocks.domainsByTechnology.mockResolvedValue([]);

  await StoreFinderService.startStoreSearch(
    {
      projectId: "p1",
      technology: "Shopify",
      keywords: ["skincare", "serum"],
      limit: 20,
    },
    billing,
  );

  expect(
    mocks.domainsByTechnology.mock.calls.map(([input]) => [
      input.keywords,
      input.limit,
    ]),
  ).toEqual([
    [["skincare"], 10],
    [["serum"], 10],
  ]);
});
