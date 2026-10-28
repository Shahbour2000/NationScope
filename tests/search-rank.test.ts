import { describe, expect, it } from "vitest";
import { matchScore, normalize, rankSuggestions, type Suggestion } from "@/features/search/rank";

const s = (type: Suggestion["type"], id: string, name: string): Suggestion => ({ type, id, name, image: null, sub: null, href: `/${type}/${id}` });

describe("normalize", () => {
  it("is case, space and accent insensitive", () => {
    expect(normalize("  São   Tomé ")).toBe("sao tome");
    expect(normalize("EGYPT")).toBe("egypt");
  });
  it("folds Arabic variants, diacritics, tatweel and digits", () => {
    expect(normalize("أحمد")).toBe(normalize("احمد"));
    expect(normalize("مَصْر")).toBe("مصر");
    expect(normalize("مدينة")).toBe(normalize("مدينه"));
    expect(normalize("علـــي")).toBe("علي");
    expect(normalize("٢٠٢٦")).toBe("2026");
  });
});

describe("matchScore", () => {
  it("ranks exact > prefix > word-prefix > substring > none", () => {
    expect([matchScore("egypt", "Egypt"), matchScore("egy", "Egypt"), matchScore("ken", "Black Knights"), matchScore("ght", "Black Knights"), matchScore("zzz", "Egypt")]).toEqual([100, 80, 0, 40, 0]);
    expect(matchScore("kni", "Black Knights")).toBe(60);
  });
  it("supports middle-of-name matches", () => expect(matchScore("alent", "Bloody Valentine")).toBe(40));
});

describe("rankSuggestions", () => {
  const items = [s("player", "1", "Egypt Fan"), s("country", "eg", "Egypt"), s("unit", "u1", "Egyptian Eagles"), s("alliance", "a", "Pact of steel")];
  it("puts a unique exact match first", () => {
    expect(rankSuggestions("Egypt", items).map((x) => x.id)).toEqual(["eg", "1", "u1"]);
  });
  it("keeps ambiguous exact names (different types) and orders them by type", () => {
    const amb = [s("player", "p", "Sparta"), s("unit", "u", "Sparta"), s("country", "c", "Sparta")];
    expect(rankSuggestions("sparta", amb).map((x) => x.type)).toEqual(["country", "player", "unit"]);
  });
  it("finds partial and middle matches, drops non-matches, honours the limit and collapses duplicates", () => {
    expect(rankSuggestions("steel", items).map((x) => x.id)).toEqual(["a"]);
    expect(rankSuggestions("e", items, 2)).toHaveLength(2);
    expect(rankSuggestions("egypt", [...items, s("country", "eg", "Egypt")]).filter((x) => x.id === "eg")).toHaveLength(1);
  });
  it("returns nothing for an empty or unmatched query", () => {
    expect(rankSuggestions("", items)).toEqual([]);
    expect(rankSuggestions("qqq", items)).toEqual([]);
  });
});
