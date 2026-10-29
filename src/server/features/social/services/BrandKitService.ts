import { BrandKitRepository } from "@/server/features/social/repositories/BrandKitRepository";
import type { BrandKitInput } from "@/types/schemas/social";

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function get(projectId: string) {
  const row = await BrandKitRepository.get(projectId);
  if (!row) return null;
  return {
    tone: row.tone,
    targetAudience: row.targetAudience,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    accentColor: row.accentColor,
    headingFont: row.headingFont,
    bodyFont: row.bodyFont,
    logoUrl: row.logoUrl,
    bannedPhrases: row.bannedPhrases,
    updatedAt: row.updatedAt,
  };
}

async function save(projectId: string, input: BrandKitInput) {
  await BrandKitRepository.upsert(projectId, {
    tone: clean(input.tone),
    targetAudience: clean(input.targetAudience),
    primaryColor: clean(input.primaryColor),
    secondaryColor: clean(input.secondaryColor),
    accentColor: clean(input.accentColor),
    headingFont: clean(input.headingFont),
    bodyFont: clean(input.bodyFont),
    logoUrl: clean(input.logoUrl),
    bannedPhrases:
      input.bannedPhrases
        ?.split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n") || null,
  });
  return get(projectId);
}

export function renderBrandKit(kit: Awaited<ReturnType<typeof get>>) {
  if (!kit)
    return "## Brand kit\n\n_Empty_ (fill it with save_brand_kit or in the Context page)";
  return [
    "## Brand kit",
    "",
    `- Tone: ${kit.tone ?? "?"}`,
    `- Target audience: ${kit.targetAudience ?? "?"}`,
    `- Colors: ${[kit.primaryColor, kit.secondaryColor, kit.accentColor].filter(Boolean).join(", ") || "?"}`,
    `- Fonts: ${[kit.headingFont, kit.bodyFont].filter(Boolean).join(" / ") || "?"}`,
    `- Logo: ${kit.logoUrl ?? "none"}`,
    `- Banned phrases (never use): ${kit.bannedPhrases?.split("\n").join("; ") || "none"}`,
  ].join("\n");
}

export const BrandKitService = { get, save };
