export const LEAD_MAIL_STEPS = [1, 2, 3] as const;
export type LeadMailStep = (typeof LEAD_MAIL_STEPS)[number];

/** Business days to wait after mail 1 and mail 2 before the next one. */
const GAP_AFTER: Record<1 | 2, number> = { 1: 3, 2: 5 };

function addBusinessDays(date: string, days: number): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const weekday = d.getUTCDay();
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return d.toISOString().slice(0, 10);
}

/** The day the next mail is due, given how many have gone out and when the last one did. */
export function followUpDueOn(sentSteps: 1 | 2, lastSentAt: string): string {
  return addBusinessDays(lastSentAt, GAP_AFTER[sentSteps]);
}
