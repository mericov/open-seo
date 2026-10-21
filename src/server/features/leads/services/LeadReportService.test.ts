import { beforeEach, expect, it, vi } from "vitest";
import { LeadReportService } from "@/server/features/leads/services/LeadReportService";

const mocks = vi.hoisted(() => ({
  objects: new Map<string, string>(),
  getReportToken: vi.fn(),
  setReportToken: vi.fn(),
  reportTokenExists: vi.fn(),
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
  },
}));

beforeEach(() => {
  mocks.getReportToken.mockResolvedValue({ reportToken: null });
  mocks.reportTokenExists.mockResolvedValue(true);
});

it("stores a report without scripts and serves it sandboxed at its link", async () => {
  const { token } = await LeadReportService.save(
    "p1",
    "lead-1",
    "<html><body><h1>Audit</h1><script>alert(1)</script></body></html>",
  );

  expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
  expect(mocks.setReportToken).toHaveBeenCalledWith("p1", "lead-1", token);

  const response = await LeadReportService.render(token);
  expect(await response.text()).toBe(
    "<html><body><h1>Audit</h1></body></html>",
  );
  expect(response.headers.get("content-security-policy")).toContain("sandbox");

  mocks.reportTokenExists.mockResolvedValue(false);
  expect((await LeadReportService.render(token)).status).toBe(404);
});
