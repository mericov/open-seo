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
