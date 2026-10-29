import { shopifyGraphql } from "@/server/features/shopify/services/shopifyClient";

type Money = { amount: string; currencyCode: string };

const CATALOG_QUERY = `query MericSeoSocialCatalog {
  collections(first: 40, sortKey: UPDATED_AT, reverse: true) {
    nodes { title handle description image { url } }
  }
  products(first: 80, sortKey: UPDATED_AT, reverse: true, query: "status:active") {
    nodes {
      title handle productType tags
      priceRangeV2 { minVariantPrice { amount currencyCode } }
      featuredMedia { preview { image { url } } }
      media(first: 4) { nodes { preview { image { url } } } }
    }
  }
  pages(first: 40) { nodes { title handle } }
  articles(first: 40, sortKey: PUBLISHED_AT, reverse: true) {
    nodes { title handle publishedAt tags image { url } blog { handle } }
  }
}`;

const MENU_QUERY = `query MericSeoSocialMenu {
  menus(first: 5) { nodes { handle title items { title url items { title url } } } }
}`;

type CatalogResult = {
  collections: {
    nodes: {
      title: string;
      handle: string;
      description: string | null;
      image: { url: string } | null;
    }[];
  };
  products: {
    nodes: {
      title: string;
      handle: string;
      productType: string | null;
      tags: string[];
      priceRangeV2: { minVariantPrice: Money } | null;
      featuredMedia: {
        preview: { image: { url: string } | null } | null;
      } | null;
      media: {
        nodes: { preview: { image: { url: string } | null } | null }[];
      };
    }[];
  };
  pages: { nodes: { title: string; handle: string }[] };
  articles: {
    nodes: {
      title: string;
      handle: string;
      publishedAt: string | null;
      tags: string[];
      image: { url: string } | null;
      blog: { handle: string } | null;
    }[];
  };
};

type MenuItem = { title: string; url: string | null; items?: MenuItem[] };
type MenuResult = {
  menus: { nodes: { handle: string; title: string; items: MenuItem[] }[] };
};

export async function loadShopifyCatalog(projectId: string, origin: string) {
  const data = await shopifyGraphql<CatalogResult>(projectId, CATALOG_QUERY);
  return {
    collections: data.collections.nodes.map((node) => ({
      title: node.title,
      url: `${origin}/collections/${node.handle}`,
      description: node.description?.slice(0, 200) || null,
      image: node.image?.url ?? null,
    })),
    products: data.products.nodes.map((node) => ({
      title: node.title,
      url: `${origin}/products/${node.handle}`,
      type: node.productType || null,
      tags: node.tags.slice(0, 8),
      price: node.priceRangeV2
        ? `${node.priceRangeV2.minVariantPrice.amount} ${node.priceRangeV2.minVariantPrice.currencyCode}`
        : null,
      images: [
        node.featuredMedia?.preview?.image?.url,
        ...node.media.nodes.map((media) => media.preview?.image?.url),
      ].filter(
        (url, index, all): url is string =>
          Boolean(url) && all.indexOf(url) === index,
      ),
    })),
    pages: data.pages.nodes.map((node) => ({
      title: node.title,
      url: `${origin}/pages/${node.handle}`,
    })),
    articles: data.articles.nodes.map((node) => ({
      title: node.title,
      url: `${origin}/blogs/${node.blog?.handle ?? "news"}/${node.handle}`,
      publishedAt: node.publishedAt,
      tags: node.tags.slice(0, 8),
      image: node.image?.url ?? null,
    })),
  };
}

export async function loadShopifyMenu(projectId: string, origin: string) {
  const data = await shopifyGraphql<MenuResult>(projectId, MENU_QUERY);
  const main =
    data.menus.nodes.find((menu) => menu.handle === "main-menu") ??
    data.menus.nodes[0];
  const flatten = (
    items: MenuItem[],
    depth: number,
  ): { title: string; url: string }[] =>
    items.flatMap((item) => [
      ...(item.url
        ? [
            {
              title: `${"- ".repeat(depth)}${item.title}`,
              url: new URL(item.url, origin).href,
            },
          ]
        : []),
      ...(item.items ? flatten(item.items, depth + 1) : []),
    ]);
  return main ? flatten(main.items, 0) : [];
}
