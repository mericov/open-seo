import { sortBy } from "remeda";
import { emailIsOnDomain } from "@/server/lib/leads/contactExtractor";

// Free checks for an email found on a business website. They catch dead
// domains and typos, and sort addresses by how likely a person reads them.
// They cannot prove a mailbox exists: that needs an SMTP conversation on port
// 25, which Workers cannot open.

const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const MX_RECORD_TYPE = 15;

const ROLE_LOCAL_PARTS = new Set([
  "info",
  "hello",
  "contact",
  "support",
  "sales",
  "office",
  "admin",
  "team",
  "help",
  "mail",
  "service",
  "booking",
  "bookings",
  "reservations",
  "careers",
  "jobs",
  "hr",
  "billing",
  "accounts",
  "marketing",
  "press",
  "media",
  "design",
  "staging",
  "iletisim",
  "bilgi",
  "destek",
  "satis",
  "muhasebe",
]);

const FREE_PROVIDER_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "yandex.com",
  "yandex.com.tr",
  "mynet.com",
  "hotmail.com.tr",
]);

// Recruiting and billing inboxes are on the site but never the right first
// contact for a sales email.
const DEPRIORITIZED_LOCAL_PARTS = new Set([
  "careers",
  "jobs",
  "hr",
  "billing",
  "accounts",
  "muhasebe",
]);

type EmailCheck = {
  email: string;
  checkStatus: "mx_ok" | "no_mx" | "invalid";
  kind: "personal" | "role" | "free_provider";
  onOwnDomain: boolean;
};

export async function checkEmails(
  emails: string[],
  siteDomain: string | null,
): Promise<EmailCheck[]> {
  const mxByDomain = new Map<string, Promise<boolean | null>>();
  const hasMx = (domain: string) => {
    let pending = mxByDomain.get(domain);
    if (!pending) {
      pending = lookupMx(domain);
      mxByDomain.set(domain, pending);
    }
    return pending;
  };

  return Promise.all(
    emails.map(async (email): Promise<EmailCheck> => {
      const [local = "", domain = ""] = email.split("@");
      const { kind, onOwnDomain } = classifyEmail(email, siteDomain);
      if (!local || !domain) {
        return { email, checkStatus: "invalid", kind, onOwnDomain };
      }
      // A failed DNS lookup is unknown, not dead: keep the address usable.
      const mx = FREE_PROVIDER_DOMAINS.has(domain) ? true : await hasMx(domain);
      return {
        email,
        checkStatus: mx === false ? "no_mx" : "mx_ok",
        kind,
        onOwnDomain,
      };
    }),
  );
}

export function classifyEmail(
  email: string,
  siteDomain: string | null,
): Pick<EmailCheck, "kind" | "onOwnDomain"> {
  const [local = "", domain = ""] = email.split("@");
  const kind = FREE_PROVIDER_DOMAINS.has(domain)
    ? "free_provider"
    : ROLE_LOCAL_PARTS.has(local)
      ? "role"
      : "personal";
  const onOwnDomain = siteDomain ? emailIsOnDomain(email, siteDomain) : false;
  return { kind, onOwnDomain };
}

/** The address to write to first: reachable, on the site's domain, a person. */
export function pickPrimaryEmail(checks: EmailCheck[]): string | null {
  const score = (check: EmailCheck) => {
    const local = check.email.split("@")[0] ?? "";
    let value = 0;
    if (check.onOwnDomain) value += 4;
    else if (check.kind !== "free_provider") value -= 3;
    if (check.kind === "personal") value += 2;
    if (check.kind === "role") value += 1;
    if (DEPRIORITIZED_LOCAL_PARTS.has(local)) value -= 4;
    return value;
  };
  const best = sortBy(
    checks.filter((check) => check.checkStatus === "mx_ok"),
    (check) => -score(check),
  )[0];
  return best?.email ?? null;
}

export async function dohQuery(
  name: string,
  type: "MX" | "TXT",
): Promise<{
  status: number;
  answers: { type: number; data: string }[];
} | null> {
  try {
    const response = await fetch(
      `${DOH_ENDPOINT}?name=${encodeURIComponent(name)}&type=${type}`,
      {
        headers: { Accept: "application/dns-json" },
        signal: AbortSignal.timeout(2_500),
      },
    );
    if (!response.ok) return null;
    const body: {
      Status?: number;
      Answer?: { type?: number; data?: string }[];
    } = await response.json();
    return {
      status: body.Status ?? -1,
      answers: (body.Answer ?? []).map((answer) => ({
        type: answer.type ?? 0,
        data: answer.data ?? "",
      })),
    };
  } catch {
    return null;
  }
}

export async function lookupMx(domain: string): Promise<boolean | null> {
  const result = await dohQuery(domain, "MX");
  if (!result) return null;
  // NXDOMAIN: the domain does not exist at all.
  if (result.status === 3) return false;
  if (result.status !== 0) return null;
  return result.answers.some((answer) => answer.type === MX_RECORD_TYPE);
}
