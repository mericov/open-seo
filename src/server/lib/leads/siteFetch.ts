import { normalizeAndValidateStartUrl } from "@/server/lib/audit/url-policy";

const LEAD_CRAWLER_USER_AGENT =
  "MericSEO-LeadFinder/1.0 (+https://seo.mericozyon.com)";

const PAGE_TIMEOUT_MS = 8_000;
const MAX_REDIRECT_HOPS = 6;
const MAX_BODY_CHARS: Record<FetchKind, number> = {
  html: 1_500_000,
  json: 4_000_000,
};

type FetchKind = "html" | "json";

export async function fetchBody(
  url: string,
  type: FetchKind,
): Promise<{ body: string; finalUrl: string } | null> {
  let current = url;
  try {
    for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
      const response = await fetch(current, {
        headers: {
          "User-Agent": LEAD_CRAWLER_USER_AGENT,
          Accept: type === "html" ? "text/html" : "application/json",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) return null;
        current = await normalizeAndValidateStartUrl(
          new URL(location, current).toString(),
        );
        continue;
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.toLowerCase().includes(type)) {
        await response.body?.cancel();
        return null;
      }
      const body = (await response.text()).slice(0, MAX_BODY_CHARS[type]);
      return { body, finalUrl: current };
    }
  } catch {
    return null;
  }
  return null;
}

export async function fetchText(
  url: string,
): Promise<{ status: number; location: string | null; body: string } | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": LEAD_CRAWLER_USER_AGENT },
      redirect: "manual",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    const location = response.headers.get("location");
    if (!response.ok) {
      await response.body?.cancel();
      return { status: response.status, location, body: "" };
    }
    return {
      status: response.status,
      location,
      body: (await response.text()).slice(0, 200_000),
    };
  } catch {
    return null;
  }
}
