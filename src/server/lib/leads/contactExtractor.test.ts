import { beforeEach, describe, expect, it, vi } from "vitest";
import { findSiteContacts } from "@/server/lib/leads/contactExtractor";

type Route = { status?: number; body: string; type?: string };

let routes: Record<string, Route> = {};
const fetchMock = vi.fn(async (input: string | URL) => {
  const url = String(input);
  if (url.startsWith("https://cloudflare-dns.com/")) {
    return Response.json({
      Status: 0,
      Answer: [{ type: 1, data: "93.184.216.34" }],
    });
  }
  const route = routes[url];
  if (!route) return new Response("not found", { status: 404 });
  return new Response(route.body, {
    status: route.status ?? 200,
    headers: { "content-type": route.type ?? "text/html; charset=utf-8" },
  });
});

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  routes = {};
});

// Cloudflare's email obfuscation: first byte is the XOR key.
function cfEncode(email: string, key = 0x42) {
  const bytes = [key];
  for (let i = 0; i < email.length; i++) bytes.push(email.charCodeAt(i) ^ key);
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

describe("findSiteContacts", () => {
  it("keeps real inboxes, drops junk, and stops at the home page when it has an own-domain email", async () => {
    routes["https://studio.test/"] = {
      body: `<html><body>
        <a href="mailto:Kyle@Studio.test?subject=Hi">Email us</a>
        <span class="__cf_email__" data-cfemail="${cfEncode("hello@studio.test")}">[email protected]</span>
        <p>logo@2x.png 0123456789abcdef0123@sentry.wixpress.com</p>
        <a href="https://www.instagram.com/p/abc123/">post</a>
        <a href="https://www.instagram.com/studio_atx/">Instagram</a>
        <a href="/contact">Contact</a>
      </body></html>`,
    };

    const result = await findSiteContacts("studio.test");

    expect(result.status).toBe("done");
    expect(result.emails).toHaveLength(2);
    expect(result.emails).toEqual(
      expect.arrayContaining(["hello@studio.test", "kyle@studio.test"]),
    );
    expect(result.instagramUrl).toBe("https://www.instagram.com/studio_atx/");
    expect(fetchMock).not.toHaveBeenCalledWith(
      "https://studio.test/contact",
      expect.anything(),
    );
  });

  it("follows a Turkish contact link when the home page shows no email", async () => {
    routes["https://cicek.test/"] = {
      body: `<html lang="tr"><body>
        <a href="/sayfa/iletisim">İletişim</a>
        <a href="https://wa.me/905321112233?text=Merhaba">WhatsApp</a>
      </body></html>`,
    };
    routes["https://cicek.test/sayfa/iletisim"] = {
      body: `<p>E-posta: siparis [at] cicek [dot] test</p>`,
    };

    const result = await findSiteContacts("https://cicek.test/");

    expect(result.emails).toEqual(["siparis@cicek.test"]);
    expect(result.contactPageUrl).toBe("https://cicek.test/sayfa/iletisim");
    expect(result.whatsappUrl).toBe("https://wa.me/905321112233");
  });

  it("reads contact pages before about pages and keeps Facebook profile ids", async () => {
    routes["https://staging.test/"] = {
      body: `<a href="about-1.html">About</a>
        <a href="/team">More about us</a>
        <a href="contact-us.html">Contact us</a>
        <a href="https://www.facebook.com/profile.php?id=100044057606415&mibextid=x">fb</a>`,
    };
    routes["https://staging.test/contact-us.html"] = {
      body: `<p>Email:<br>Staging@Staging.test<br>Send us your questions</p>`,
    };

    const result = await findSiteContacts("https://staging.test/");

    expect(result.emails).toEqual(["staging@staging.test"]);
    expect(result.facebookUrl).toBe(
      "https://www.facebook.com/profile.php?id=100044057606415",
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "https://staging.test/about-1.html",
      expect.anything(),
    );
  });

  it("reads a Shopify store's contact page and catalog stats", async () => {
    routes["https://shop.test/"] = {
      body: `<a href="/collections/all">Shop</a>`,
    };
    routes["https://shop.test/pages/contact"] = {
      body: `<p>Write to hello@shop.test</p>`,
    };
    routes["https://shop.test/meta.json"] = {
      body: JSON.stringify({
        name: "Shop",
        country: "tr",
        currency: "TRY",
        myshopify_domain: "shop.myshopify.com",
        published_products_count: 42,
      }),
      type: "application/json",
    };
    routes["https://shop.test/products.json?limit=5"] = {
      body: JSON.stringify({
        products: [
          { published_at: "2026-09-01T10:00:00Z" },
          { published_at: "2026-10-01T10:00:00Z" },
        ],
      }),
      type: "application/json",
    };

    const result = await findSiteContacts("https://shop.test/", {
      shopify: true,
    });

    expect(result.emails).toEqual(["hello@shop.test"]);
    expect(result.shopify).toEqual({
      name: "Shop",
      countryCode: "TR",
      currency: "TRY",
      productCount: 42,
      lastProductAt: "2026-10-01T10:00:00.000Z",
    });
  });

  it("respects a robots.txt that disallows the site", async () => {
    routes["https://private.test/"] = {
      body: `<a href="mailto:owner@private.test">mail</a>`,
    };
    routes["https://private.test/robots.txt"] = {
      body: "User-agent: *\nDisallow: /",
      type: "text/plain",
    };

    const result = await findSiteContacts("private.test");

    expect(result).toMatchObject({ status: "failed", emails: [] });
  });
});
