import { describe, expect, it } from "vitest";
import { KNOWN_ROLE_ORDER, leadershipHolders } from "@/features/government/roles";
import { getMessages } from "@/i18n";

const r = (role: string, id = role) => ({ role, id });
describe("leadershipHolders", () => {
  it("includes the foreign affairs minister and excludes congress", () => {
    const out = leadershipHolders([r("congress", "c1"), r("ministerForeignAffairs"), r("president")]);
    expect(out.map((x) => x.role)).toEqual(["president", "ministerForeignAffairs"]);
  });
  it("keeps unknown future roles instead of dropping them, after the known ones", () => {
    expect(leadershipHolders([r("newRole"), r("ministerEconomy")]).map((x) => x.role)).toEqual(["ministerEconomy", "newRole"]);
  });
  it("does not duplicate holders", () => {
    expect(leadershipHolders([r("president", "a"), r("president", "b")])).toHaveLength(2);
  });
  it("every known role has an English and Arabic label", () => {
    for (const loc of ["en", "ar"] as const) for (const k of KNOWN_ROLE_ORDER) expect((getMessages(loc).t.role as Record<string, string>)[k]).toBeTruthy();
  });
});
