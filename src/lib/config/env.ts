import { z } from "zod";
import { API_PATH_PREFIX_DEFAULT, ENVIRONMENTS, type ApiEnvironment } from "./environments";

export type { ApiEnvironment };

/** Thrown for invalid or missing configuration. Messages name variables only, never values. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface AppConfig {
  environment: ApiEnvironment;
  /** Origin of the selected environment only (scheme + host). */
  origin: string;
  pathPrefix: string;
  timeoutMs: number;
  maxRequestsPerMinute: number;
  cacheTtlMs: number;
  staleMaxAgeMs: number;
}

const schema = z.object({
  NATIONSCOPE_API_ENV: z.enum(["main", "development"]).default("main"),
  AOW_MAIN_API_ORIGIN: z.string().url().optional(),
  AOW_DEV_API_ORIGIN: z.string().url().optional(),
  AOW_API_PATH_PREFIX: z
    .string()
    .regex(/^\/[A-Za-z0-9/_-]*$/, "must start with / and contain only letters, digits, / _ -")
    .default(API_PATH_PREFIX_DEFAULT),
  AOW_API_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),
  AOW_API_MAX_REQUESTS_PER_MINUTE: z.coerce.number().int().min(1).max(60).default(40),
  AOW_CACHE_TTL_MS: z.coerce.number().int().min(0).max(300000).default(30000),
  AOW_STALE_MAX_AGE_MS: z.coerce.number().int().min(0).max(3600000).default(300000),
  NATIONSCOPE_ALLOW_DEV_API_IN_PRODUCTION: z.enum(["true", "false"]).default("false"),
});

function normalizeOrigin(name: string, value: string): string {
  const url = new URL(value);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !local) {
    throw new ConfigError(`${name} must use https.`);
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new ConfigError(`${name} must be an origin only; set the path in AOW_API_PATH_PREFIX.`);
  }
  return url.origin;
}

export function loadConfig(
  env: Record<string, string | undefined> = process.env,
  nodeEnv: string | undefined = env.NODE_ENV,
): AppConfig {
  const cleaned = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== undefined && v !== ""),
  );
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))].join(", ");
    throw new ConfigError(`Invalid environment configuration: ${names}.`);
  }
  const v = parsed.data;
  const environment = v.NATIONSCOPE_API_ENV;

  if (
    environment === "development" &&
    nodeEnv === "production" &&
    v.NATIONSCOPE_ALLOW_DEV_API_IN_PRODUCTION !== "true"
  ) {
    throw new ConfigError(
      "The development API is blocked in production. Set NATIONSCOPE_ALLOW_DEV_API_IN_PRODUCTION=true to override explicitly.",
    );
  }

  const { originVar, defaultOrigin } = ENVIRONMENTS[environment];
  // Each environment resolves ONLY from its own variable or its own default. No cross-environment fallback.
  const raw = (environment === "main" ? v.AOW_MAIN_API_ORIGIN : v.AOW_DEV_API_ORIGIN) ?? defaultOrigin;
  const varName = originVar;

  return {
    environment,
    origin: normalizeOrigin(varName, raw),
    pathPrefix: v.AOW_API_PATH_PREFIX.replace(/\/+$/, ""),
    timeoutMs: v.AOW_API_TIMEOUT_MS,
    maxRequestsPerMinute: v.AOW_API_MAX_REQUESTS_PER_MINUTE,
    cacheTtlMs: v.AOW_CACHE_TTL_MS,
    staleMaxAgeMs: v.AOW_STALE_MAX_AGE_MS,
  };
}

let cached: { key: string; config: AppConfig } | undefined;

/** Server-only. Cached per process; re-reads if the relevant variables change. */
export function getConfig(): AppConfig {
  const key = JSON.stringify(
    Object.entries(process.env).filter(([k]) => k.startsWith("AOW_") || k.startsWith("NATIONSCOPE_") || k === "NODE_ENV"),
  );
  if (cached?.key === key) return cached.config;
  const config = loadConfig();
  cached = { key, config };
  return config;
}

/** Like getConfig but returns null instead of throwing (for chrome that must always render). */
export function tryGetConfig(): AppConfig | null {
  try {
    return getConfig();
  } catch {
    return null;
  }
}
