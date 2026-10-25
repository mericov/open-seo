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
      delete: async (key: string) => mocks.objects.delete(key),
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
  mocks.reportTokenExists.mockResolvedValue(false);
});

it("stores a report without scripts and serves it sandboxed at its link", async () => {
  const { token } = await LeadReportService.save(
    "p1",
    "lead-1",
    "<html><body><h1>Audit</h1><script>alert(1)</script></body></html>",
  );

  expect(token).toBe("3ina");
  expect(mocks.setReportToken).toHaveBeenCalledWith("p1", "lead-1", token);
  mocks.reportTokenExists.mockResolvedValue(true);

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

it("gives a report with an old long link a short one on refresh", async () => {
  const old = "A".repeat(32);
  mocks.objects.set(`lead-reports/${old}.html`, "<p>old</p>");
  mocks.getReportToken.mockResolvedValue({
    reportToken: old,
    domain: "3ina.com",
    website: null,
  });

  const { token } = await LeadReportService.save("p1", "lead-1", "<p>new</p>");

  expect(token).toBe("3ina");
  expect(mocks.objects.has(`lead-reports/${old}.html`)).toBe(false);
});

it("falls back to the full domain when another lead already uses the brand link", async () => {
  mocks.reportTokenExists.mockImplementation(
    async (token: string) => token === "3ina",
  );

  const { token } = await LeadReportService.save("p1", "lead-1", "<p>new</p>");

  expect(token).toBe("3ina-com");
});
