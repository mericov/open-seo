import { beforeEach, expect, it, vi } from "vitest";
import { LeadReportService } from "@/server/features/leads/services/LeadReportService";

const mocks = vi.hoisted(() => ({
  objects: new Map<string, string>(),
  getReportToken: vi.fn(),
  setReportToken: vi.fn(),
  reportTokenExists: vi.fn(),
  recordReportView: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: {
    R2: {
      put: async (key: string, body: string) => mocks.objects.set(key, body),
      get: async (key: string) => {
        const body = mocks.objects.get(key);
        return body === undefined ? null : { text: async () => body };
      },
    },
  },
}));
vi.mock("@/server/features/leads/repositories/LeadListRepository", () => ({
  LeadListRepository: {
    getReportToken: mocks.getReportToken,
    setReportToken: mocks.setReportToken,
    reportTokenExists: mocks.reportTokenExists,
    recordReportView: mocks.recordReportView,
  },
}));

beforeEach(() => {
  mocks.getReportToken.mockResolvedValue({
    reportToken: null,
    domain: "www.3ina.com",
    website: null,
  });
  mocks.reportTokenExists.mockResolvedValue(true);
});

it("stores a report without scripts and serves it sandboxed at its link", async () => {
  const { token } = await LeadReportService.save(
    "p1",
    "lead-1",
    "<html><body><h1>Audit</h1><script>alert(1)</script></body></html>",
  );

  expect(token).toMatch(/^3ina-[a-z0-9]{6}$/);
  expect(mocks.setReportToken).toHaveBeenCalledWith("p1", "lead-1", token);

  const visit = (query = "") =>
    new Request(`https://seo.example/audit/${token}${query}`, {
      headers: { "user-agent": "Mozilla/5.0 (Macintosh)" },
    });
  const response = await LeadReportService.render(visit(), token);
  expect(await response.text()).toBe(
    "<html><body><h1>Audit</h1></body></html>",
  );
  expect(response.headers.get("content-security-policy")).toContain("sandbox");
  expect(mocks.recordReportView).toHaveBeenCalledTimes(1);

  await LeadReportService.render(visit("?preview"), token);
  expect(mocks.recordReportView).toHaveBeenCalledTimes(1);

  mocks.reportTokenExists.mockResolvedValue(false);
  expect((await LeadReportService.render(visit(), token)).status).toBe(404);
});
