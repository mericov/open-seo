const JSON_LD_PATTERN =
  /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;

type JsonNode = Record<string, unknown>;

function isNode(value: unknown): value is JsonNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function jsonLdNodes(html: string): JsonNode[] {
  const nodes: JsonNode[] = [];
  const visit = (value: unknown, depth: number) => {
    if (depth > 6) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (!isNode(value)) return;
    if ("@type" in value) nodes.push(value);
    for (const child of Object.values(value)) visit(child, depth + 1);
  };
  for (const match of html.matchAll(JSON_LD_PATTERN)) {
    try {
      visit(JSON.parse(match[1]), 0);
    } catch {
      continue;
    }
  }
  return nodes;
}

export function nodeTypes(node: JsonNode): string[] {
  const type = node["@type"];
  const list = Array.isArray(type) ? type : [type];
  return list.filter((value): value is string => typeof value === "string");
}

export function hasType(nodes: JsonNode[], types: readonly string[]): boolean {
  return nodes.some((node) =>
    nodeTypes(node).some((type) => types.includes(type)),
  );
}

export function firstOfType(
  nodes: JsonNode[],
  types: readonly string[],
): JsonNode | null {
  return (
    nodes.find((node) =>
      nodeTypes(node).some((type) => types.includes(type)),
    ) ?? null
  );
}

export function asNodes(value: unknown): JsonNode[] {
  return (Array.isArray(value) ? value : [value]).filter(isNode);
}
