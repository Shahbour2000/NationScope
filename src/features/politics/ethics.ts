/** "industrial:fanatic" -> ["industrial", "fanatic"]; labels come from translations, unknown codes fall back to readable text. */
export function ethicLabel(code: string, dict: Record<string, string>, humanize: (c: string) => string): string {
  const [base, tier] = code.split(":");
  const name = dict[base ?? ""] ?? humanize(base ?? code);
  return tier ? `${name} · ${dict[tier] ?? humanize(tier)}` : name;
}
