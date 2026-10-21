import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkEmails, pickPrimaryEmail } from "@/server/lib/leads/emailChecks";

const fetchMock = vi.fn(async (input: string | URL) => {
  const name = new URL(String(input)).searchParams.get("name");
  if (name === "dead-domain.test") return Response.json({ Status: 3 });
  return Response.json({
    Status: 0,
    Answer: [{ type: 15, data: "10 mx.test." }],
  });
});

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

describe("checkEmails", () => {
  it("flags domains that do not exist and classifies the rest", async () => {
    const checks = await checkEmails(
      ["owner@dead-domain.test", "info@studio.test", "studio.atx@gmail.com"],
      "studio.test",
    );

    expect(checks).toEqual([
      {
        email: "owner@dead-domain.test",
        checkStatus: "no_mx",
        kind: "personal",
        onOwnDomain: false,
      },
      {
        email: "info@studio.test",
        checkStatus: "mx_ok",
        kind: "role",
        onOwnDomain: true,
      },
      {
        email: "studio.atx@gmail.com",
        checkStatus: "mx_ok",
        kind: "free_provider",
        onOwnDomain: false,
      },
    ]);
  });
});

describe("pickPrimaryEmail", () => {
  it("prefers a person on the site's domain and never picks a careers inbox or a dead address", async () => {
    const checks = await checkEmails(
      [
        "careers@studio.test",
        "info@studio.test",
        "kyle@studio.test",
        "boss@dead-domain.test",
      ],
      "studio.test",
    );

    expect(pickPrimaryEmail(checks)).toBe("kyle@studio.test");
    expect(
      pickPrimaryEmail(checks.filter((c) => c.email !== "kyle@studio.test")),
    ).toBe("info@studio.test");
  });

  it("prefers the store's own free inbox over a theme or app vendor's address", async () => {
    const checks = await checkEmails(
      ["support@halothemes.test", "romanbridal@gmail.com"],
      "romanbridal.test",
    );

    expect(pickPrimaryEmail(checks)).toBe("romanbridal@gmail.com");
  });
});
