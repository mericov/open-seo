const NON_PERSON_AUTHORS =
  /haber merkezi|merkez|editör|editor|admin|redaksiyon|news desk|staff|ajans|agency|team|ekibi|\b(aa|dha|iha|anka|reuters|afp|ap)\b/i;

export function nameKey(name: string): string {
  return `name:${foldName(name)}`;
}

function foldName(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .normalize("NFKD")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanPersonName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 5 || name.length > 60) return null;
  const words = name.split(" ");
  if (words.length < 2 || words.length > 4) return null;
  if (NON_PERSON_AUTHORS.test(name)) return null;
  if (!/^[\p{L}'’.\s-]+$/u.test(name)) return null;
  return name;
}

export function emailMatchesName(email: string, name: string): boolean {
  const local = foldName((email.split("@")[0] ?? "").replace(/[._-]/g, " "));
  const tokens = foldName(name)
    .split(" ")
    .filter((token) => token.length >= 3);
  return tokens.some((token) => local.includes(token));
}
