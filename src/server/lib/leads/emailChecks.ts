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
    if (check.checkStatus !== "mx_ok") return -1;
    const local = check.email.split("@")[0] ?? "";
    let value = 0;
    if (check.onOwnDomain) value += 4;
    if (check.kind === "personal") value += 2;
    if (check.kind === "role") value += 1;
    if (DEPRIORITIZED_LOCAL_PARTS.has(local)) value -= 4;
    return value;
  };
  const best = sortBy(
    checks.filter((check) => score(check) >= 0),
    (check) => -score(check),
  )[0];
  return best?.email ?? null;
}

async function lookupMx(domain: string): Promise<boolean | null> {
  try {
    const response = await fetch(
      `${DOH_ENDPOINT}?name=${encodeURIComponent(domain)}&type=MX`,
      {
        headers: { Accept: "application/dns-json" },
        signal: AbortSignal.timeout(2_500),
      },
    );
    if (!response.ok) return null;
    const body: { Status?: number; Answer?: { type?: number }[] } =
      await response.json();
    // NXDOMAIN: the domain does not exist at all.
    if (body.Status === 3) return false;
    if (body.Status !== 0) return null;
    return (body.Answer ?? []).some((answer) => answer.type === MX_RECORD_TYPE);
  } catch {
    return null;
  }
}
