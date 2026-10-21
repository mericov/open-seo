import type { LeadFinding } from "@/shared/leadFindings";

export function listingFindings(lead: {
  rating: number | null;
  reviewsCount: number | null;
  isClaimed: boolean | null;
  photosCount: number | null;
  hoursListed: boolean | null;
}): LeadFinding[] {
  const findings: LeadFinding[] = [];
  if (lead.isClaimed === false) findings.push({ code: "unclaimed_profile" });
  if (lead.reviewsCount != null && lead.reviewsCount < 10) {
    findings.push({ code: "few_reviews", detail: String(lead.reviewsCount) });
  }
  if (lead.rating != null && lead.rating < 4 && (lead.reviewsCount ?? 0) >= 5) {
    findings.push({ code: "low_rating", detail: lead.rating.toFixed(1) });
  }
  if (lead.hoursListed === false) findings.push({ code: "no_hours" });
  if (lead.photosCount != null && lead.photosCount < 10) {
    findings.push({ code: "few_photos", detail: String(lead.photosCount) });
  }
  return findings;
}
