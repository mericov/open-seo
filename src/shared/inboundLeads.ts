export const INBOUND_LEAD_STATUSES = [
  "new",
  "contacted",
  "client",
  "lost",
] as const;
export type InboundLeadStatus = (typeof INBOUND_LEAD_STATUSES)[number];

export const INBOUND_LEAD_VERDICTS = ["ok", "suspicious", "spam"] as const;
export type InboundLeadVerdict = (typeof INBOUND_LEAD_VERDICTS)[number];
