import { expect, it } from "vitest";
import {
  composeUrl,
  leadTemplateValues,
  renderTemplate,
} from "@/shared/leadEmail";

it("fills a template from the lead and builds a ready-to-send Gmail draft", () => {
  const values = leadTemplateValues(
    {
      name: "Kari Gran",
      firstLine: null,
      website: "https://karigran.com/",
      domain: "karigran.com",
      findings: ["no_schema", "no_blog"],
    },
    "en",
  );
  const body = renderTemplate("Hi {{name}}, {{top_gap}}. {{unknown}}", values);

  expect(body).toBe(
    "Hi Kari Gran, Google and AI assistants get little detail about your site. {{unknown}}",
  );
  expect(values.first_line).toMatch(/quick look/);

  const url = new URL(
    composeUrl("gmail", { to: "info@karigran.com", subject: "Hi", body }),
  );
  expect(url.searchParams.get("to")).toBe("info@karigran.com");
  expect(url.searchParams.get("body")).toBe(body);
});

it("uses the project's own finding sentence in place of the default", () => {
  const values = leadTemplateValues(
    {
      name: "Kadıköy Diş",
      firstLine: null,
      website: null,
      domain: "kadikoydis.com.tr",
      findings: ["no_blog", "stale_blog"],
    },
    "tr",
    null,
    {
      no_blog: "düzenli bir blogunuzun olmaması",
      stale_blog: "son yazı {detail}",
    },
  );

  expect(values.top_gap).toBe("düzenli bir blogunuzun olmaması");
  expect(values.top_issues).toBe(
    "- Düzenli bir blogunuzun olmaması\n- Son yazı",
  );
});

it("links the report in the offer sentence once a report exists", () => {
  const lead = {
    name: "Kadıköy Diş",
    firstLine: "x",
    website: null,
    domain: "kadikoydis.com.tr",
    findings: [],
  };

  expect(leadTemplateValues(lead, "tr").report_offer).toMatch(/gönderebilirim/);
  expect(
    leadTemplateValues(lead, "tr", "https://seo.test/lr/abc").report_offer,
  ).toContain("https://seo.test/lr/abc");
});
