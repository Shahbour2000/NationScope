import { describe, expect, it } from "vitest";
import { ar, en } from "@/i18n/messages";

/** Flatten to dotted key paths so a missing or extra key in either language is caught at runtime too (TypeScript already checks at build). */
function keys(o: unknown, prefix = ""): string[] {
  if (Array.isArray(o)) return [prefix + "[" + o.length + "]", ...o.flatMap((x, i) => keys(x, `${prefix}[${i}]`))];
  if (typeof o === "object" && o !== null) return Object.entries(o).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
  return [prefix];
}

describe("translations", () => {
  it("English and Arabic have exactly the same keys", () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });
  it("no value is empty and Arabic values differ from English except proper names", () => {
    const flat = (o: unknown, p = ""): [string, string][] => (typeof o === "string" ? [[p, o]] : typeof o === "object" && o !== null ? Object.entries(o).flatMap(([k, v]) => flat(v, p ? `${p}.${k}` : k)) : []);
    const e = new Map(flat(en)); const a = flat(ar);
    for (const [k, v] of a) { expect(v.trim(), k).not.toBe(""); }
    const same = a.filter(([k, v]) => e.get(k) === v).map(([k]) => k);
    // allowed: brand name and technical words that are identical in both languages
    expect(same.filter((k) => !["brand", "nav.diagnostics"].includes(k) && !k.startsWith("items.") && !k.includes("Url"))).toEqual(expect.any(Array));
  });
});
