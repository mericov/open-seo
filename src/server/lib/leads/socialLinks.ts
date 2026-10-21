type Anchor = { href: string };

export function socialProfiles(anchors: Anchor[]) {
  return {
    instagramUrl: firstSocial(anchors, isInstagramProfile),
    facebookUrl: firstSocial(anchors, isFacebookPage),
    linkedinUrl: firstSocial(anchors, isLinkedinProfile),
    whatsappUrl: firstSocial(anchors, isWhatsappLink),
  };
}

function firstSocial(
  anchors: Anchor[],
  matches: (url: URL) => boolean,
): string | null {
  for (const { href } of anchors) {
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      continue;
    }
    if (matches(url)) {
      url.search = socialQuery(url);
      url.hash = "";
      return url.toString();
    }
  }
  return null;
}

function socialQuery(url: URL): string {
  if (url.hostname.includes("whatsapp")) return url.search;
  const profileId = url.searchParams.get("id");
  if (url.pathname === "/profile.php" && profileId) {
    return `?id=${encodeURIComponent(profileId)}`;
  }
  return "";
}

const SOCIAL_SKIP_PATHS =
  /^\/(p|reel|reels|explore|stories|share|sharer|plugins|tr|dialog|hashtag)(\/|$)/i;

function isInstagramProfile(url: URL) {
  return (
    /(^|\.)instagram\.com$/i.test(url.hostname) &&
    /^\/[^/]+\/?$/.test(url.pathname) &&
    !SOCIAL_SKIP_PATHS.test(url.pathname)
  );
}

function isFacebookPage(url: URL) {
  return (
    /(^|\.)facebook\.com$/i.test(url.hostname) &&
    url.pathname.length > 1 &&
    !SOCIAL_SKIP_PATHS.test(url.pathname)
  );
}

function isLinkedinProfile(url: URL) {
  return (
    /(^|\.)linkedin\.com$/i.test(url.hostname) &&
    /^\/(company|in)\/[^/]+/i.test(url.pathname)
  );
}

function isWhatsappLink(url: URL) {
  return (
    /^wa\.me$/i.test(url.hostname) ||
    (/(^|\.)whatsapp\.com$/i.test(url.hostname) &&
      url.pathname.startsWith("/send"))
  );
}
