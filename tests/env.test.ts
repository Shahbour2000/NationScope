import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "@/lib/config/env";
import { ENVIRONMENTS, buildApiUrl } from "@/lib/config/environments";

const MAIN = "https://main.example.test";
const DEV = "https://dev.example.test";

describe("loadConfig", () => {
  it("defaults to Main with the confirmed Main origin and /api/v1 prefix", () => {
    const c = loadConfig({}, "production");
    expect(c.environment).toBe("main");
    expect(c.origin).toBe("https://app.ageofnations.world");
    expect(c.pathPrefix).toBe("/api/v1");
  });

  it("main origin is overridable and ignores the development origin", () => {
    const c = loadConfig({ AOW_MAIN_API_ORIGIN: MAIN, AOW_DEV_API_ORIGIN: DEV }, "development");
    expect(c.origin).toBe(MAIN);
  });

  it("uses development only when explicitly selected, with its own default", () => {
    const c = loadConfig({ NATIONSCOPE_API_ENV: "development" }, "development");
    expect(c.environment).toBe("development");
    expect(c.origin).toBe(ENVIRONMENTS.development.defaultOrigin);
  });

  it("never substitutes the development origin for Main", () => {
    const c = loadConfig({ AOW_DEV_API_ORIGIN: DEV }, "production");
    expect(c.origin).toBe(ENVIRONMENTS.main.defaultOrigin);
  });

  it("blocks the development API in production unless explicitly allowed", () => {
    const env = { NATIONSCOPE_API_ENV: "development", AOW_DEV_API_ORIGIN: DEV };
    expect(() => loadConfig(env, "production")).toThrow(ConfigError);
    expect(loadConfig({ ...env, NATIONSCOPE_ALLOW_DEV_API_IN_PRODUCTION: "true" }, "production").origin).toBe(DEV);
  });

  it("rejects origins that already contain the prefix or any path, and non-https remote origins", () => {
    expect(() => loadConfig({ AOW_MAIN_API_ORIGIN: `${MAIN}/api/v1` })).toThrow(ConfigError);
    expect(() => loadConfig({ AOW_MAIN_API_ORIGIN: "http://main.example.test" })).toThrow(ConfigError);
  });

  it("treats empty strings as unset and reports bad values by name only", () => {
    expect(loadConfig({ AOW_MAIN_API_ORIGIN: "" }).origin).toBe(ENVIRONMENTS.main.defaultOrigin);
    expect(() => loadConfig({ AOW_API_TIMEOUT_MS: "5" })).toThrow(/AOW_API_TIMEOUT_MS/);
  });
});

describe("buildApiUrl", () => {
  it("joins origin, prefix and path exactly once", () => {
    expect(buildApiUrl("https://h.test/", "/api/v1", "/units")).toBe("https://h.test/api/v1/units");
  });
  it("refuses a path that repeats the prefix", () => {
    expect(() => buildApiUrl("https://h.test", "/api/v1", "/api/v1/units")).toThrow();
    expect(() => buildApiUrl("https://h.test", "/api/v1", "units")).toThrow();
  });
});
