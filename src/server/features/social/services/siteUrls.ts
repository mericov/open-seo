import { AppError } from "@/server/lib/errors";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import { ShopifyConnectionRepository } from "@/server/features/shopify/repositories/ShopifyConnectionRepository";
import { fetchUntrusted } from "@/server/features/social/services/SocialMediaService";

function bareHost(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      ?.replace(/^www\./, "") ?? ""
  );
}

export async function siteHosts(projectId: string) {
  const [project, shopify] = await Promise.all([
    ProjectRepository.getProjectById(projectId),
    ShopifyConnectionRepository.getByProjectId(projectId),
  ]);
  const hosts = new Set<string>();
  if (project?.domain) hosts.add(bareHost(project.domain));
  if (shopify?.primaryDomain) hosts.add(bareHost(shopify.primaryDomain));
  if (shopify?.shopDomain) hosts.add(bareHost(shopify.shopDomain));
  return hosts;
}

function stripTracking(url: URL) {
  for (const key of Array.from(url.searchParams.keys())) {
    if (key.startsWith("utm_") || key === "fbclid" || key === "gclid")
      url.searchParams.delete(key);
  }
  url.hash = "";
  return url;
}

export async function verifySiteUrl(projectId: string, rawUrl: string) {
  let parsed: URL;
  try {
    parsed = stripTracking(new URL(rawUrl.trim()));
  } catch {
    throw new AppError("VALIDATION_ERROR", `Not a valid URL: ${rawUrl}`);
  }
  const hosts = await siteHosts(projectId);
  if (!hosts.has(bareHost(parsed.hostname)))
    throw new AppError(
      "VALIDATION_ERROR",
      `${rawUrl} is not on the project's site (${[...hosts].join(", ") || "no domain set"}).`,
    );
  let result = await fetchUntrusted(parsed.href, "HEAD");
  if (result.response.status === 405 || result.response.status === 403)
    result = await fetchUntrusted(parsed.href, "GET");
  const finalUrl = stripTracking(new URL(result.finalUrl));
  if (!result.response.ok)
    throw new AppError(
      "VALIDATION_ERROR",
      `${rawUrl} does not load (HTTP ${result.response.status}). Pick a page that exists.`,
    );
  if (!hosts.has(bareHost(finalUrl.hostname)))
    throw new AppError(
      "VALIDATION_ERROR",
      `${rawUrl} redirects off the site to ${finalUrl.href}.`,
    );
  return finalUrl.href;
}

export function withUtm(url: string, source: string, campaign: string) {
  const parsed = new URL(url);
  parsed.searchParams.set("utm_source", source);
  parsed.searchParams.set("utm_medium", "social");
  parsed.searchParams.set("utm_campaign", campaign);
  return parsed.href;
}
