import { describe, expect, it } from "vitest";
import { MAX_PINS, addPin, groupPins, hasPin, parsePins, removePin, serializePins, togglePin, type Pin } from "@/features/pins/store";
import { flagSrc } from "@/lib/flags";
import { dirOf } from "@/i18n";

const pin = (type: Pin["type"], id: string, name = id): Pin => ({ type, id, name, image: null, href: `/${type}s/${id}`, at: 1 });

describe("pin store", () => {
  it("adds, detects and removes pins", () => {
    let p: Pin[] = [];
    p = addPin(p, pin("country", "eg", "Egypt"));
    expect(hasPin(p, "country", "eg")).toBe(true);
    expect(hasPin(p, "player", "eg")).toBe(false); // same id, different type
    p = removePin(p, "country", "eg");
    expect(p).toEqual([]);
  });
  it("never creates duplicates and refreshes the saved name in place", () => {
    let p = addPin([], pin("country", "eg", "Egypt"));
    p = addPin(p, { ...pin("country", "eg", "Arab Republic of Egypt"), at: 99 });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ name: "Arab Republic of Egypt", at: 1 }); // position/time kept
  });
  it("toggle adds then removes", () => {
    const a = pin("unit", "mu_1", "Unit");
    const once = togglePin([], a);
    expect(once).toHaveLength(1);
    expect(togglePin(once, a)).toEqual([]);
  });
  it("persists through serialize/parse (refresh) unchanged", () => {
    const p = [pin("country", "eg", "Egypt"), pin("player", "usr_1", "Mostor")];
    expect(parsePins(serializePins(p))).toEqual(p);
  });
  it("parsing is defensive: bad JSON, wrong shapes, unsafe links and duplicates are dropped", () => {
    expect(parsePins(null)).toEqual([]);
    expect(parsePins("not json")).toEqual([]);
    expect(parsePins('{"a":1}')).toEqual([]);
    const raw = JSON.stringify([
      pin("country", "eg", "Egypt"), pin("country", "eg", "Dup"),
      { type: "bogus", id: "x", name: "n", href: "/x" },
      { type: "player", id: "../x", name: "n", href: "/players/x" },
      { type: "player", id: "usr_2", name: "Evil", href: "//evil.test/x" },
      { type: "player", id: "usr_3", name: "JS", href: "javascript:alert(1)" },
      { type: "player", id: "usr_4", name: "  ", href: "/players/usr_4" },
      { type: "alliance", id: "al_1", name: "Ok", href: "/alliances/al_1", image: "javascript:alert(1)" },
    ]);
    const out = parsePins(raw);
    expect(out.map((x) => x.id)).toEqual(["eg", "al_1"]);
    expect(out[1]!.image).toBeNull(); // unsafe image dropped, pin kept
  });
  it("caps the list length", () => {
    const many = Array.from({ length: MAX_PINS + 20 }, (_, i) => pin("player", `u${i}`));
    expect(parsePins(serializePins(many))).toHaveLength(MAX_PINS);
  });
  it("groups by type in a fixed order, sorted by name, omitting empty groups", () => {
    const g = groupPins([pin("unit", "b", "Zulu"), pin("country", "eg", "Egypt"), pin("unit", "a", "Alpha")]);
    expect(g.map((x) => x.type)).toEqual(["country", "unit"]);
    expect(g[1]!.pins.map((x) => x.name)).toEqual(["Alpha", "Zulu"]);
  });
});

describe("flags and direction", () => {
  it("maps game country ids to bundled flag files", () => {
    expect(flagSrc("eg")).toBe("/flags/eg.svg");
    expect(flagSrc("uk")).toBe("/flags/gb.svg"); // the game uses uk, ISO uses gb
    expect(flagSrc("EG")).toBe("/flags/eg.svg");
    expect(flagSrc("usa-x")).toBeNull();
    expect(flagSrc("../x")).toBeNull();
  });
  it("every game country code in the real sample has a bundled flag file", async () => {
    const fs = await import("node:fs");
    const ids: string[] = JSON.parse(fs.readFileSync("tests/fixtures/real/countries.json", "utf8")).countries.map((c: { id: string }) => c.id);
    const missing = ids.filter((id) => { const src = flagSrc(id); return !src || !fs.existsSync(`public${src}`); });
    expect(missing).toEqual([]);
  });
  it("Arabic is right-to-left, English left-to-right", () => {
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("en")).toBe("ltr");
  });
});
