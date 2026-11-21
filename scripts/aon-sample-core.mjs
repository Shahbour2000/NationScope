// Core of scripts/aon-sample.mjs (kept separate so it can be unit-tested with a fake fetch). No dependencies.
const sleepReal = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One GET with the failure handling the Economy Engine requires:
 *  - 404 is the ONLY status reported as "missing".
 *  - 429 waits for Retry-After and retries; if it never clears it is "rate_limited", never "missing".
 *  - timeouts, network errors and 5xx are retried, then reported as what they are.
 */
export async function request(fetchFn, url, o = {}) {
  const { timeoutMs = 15000, retries = 3, sleep = sleepReal, maxWaitMs = 90000 } = o;
  let last = { kind: "network", message: "no attempt" };
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, { signal: ctl.signal, headers: { accept: "application/json" } });
      clearTimeout(timer);
      if (res.status === 404) return { kind: "missing", status: 404 };
      if (res.status === 429) {
        const ra = Number(res.headers?.get?.("retry-after"));
        last = { kind: "rate_limited", status: 429, retryAfter: Number.isFinite(ra) ? ra : null };
        if (attempt < retries) await sleep(Math.min(maxWaitMs, (Number.isFinite(ra) && ra > 0 ? ra : 20) * 1000));
        continue;
      }
      if (res.status >= 500) { last = { kind: "http", status: res.status }; if (attempt < retries) await sleep(1500 * (attempt + 1)); continue; }
      if (!res.ok) return { kind: "http", status: res.status };
      try { return { kind: "ok", status: res.status, data: await res.json() }; } catch { return { kind: "bad_json", status: res.status }; }
    } catch (e) {
      clearTimeout(timer);
      const timedOut = e && (e.name === "AbortError" || e.name === "TimeoutError");
      last = timedOut ? { kind: "timeout" } : { kind: "network", message: String(e && e.message ? e.message : e) };
      if (attempt < retries) await sleep(1500 * (attempt + 1));
    }
  }
  return last;
}

const SECRET_KEYS = /^(email|e-?mail|discord\w*|ip|ipAddress|token|session\w*|password|authorization|cookie)$/i;
/** Removes private-looking keys and replaces the player's name/id everywhere (also inside strings). */
export function anonymize(value, { username, ids = [] }) {
  const clean = (v) => {
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === "object") { const o = {}; for (const [k, x] of Object.entries(v)) if (!SECRET_KEYS.test(k)) o[k] = clean(x); return o; }
    return v;
  };
  let text = JSON.stringify(clean(value));
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (username) text = text.replace(new RegExp(esc(username), "gi"), "Player");
  ids.forEach((id, k) => { if (id) text = text.split(id).join(`id_${k + 1}`); });
  return JSON.parse(text);
}

export const itemCodesOf = (market) => (Array.isArray(market) ? market : market?.items ?? []).map((r) => r?.itemCode).filter((x) => typeof x === "string");
const rec = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

/**
 * Samples everything the Economy Engine needs for ONE player name, discovering every id itself.
 * `write(name, json)` stores a file; `log(msg)` reports progress. Returns a manifest.
 */
export async function sample({ fetchFn, base, player, maxCompanies = 3, extraItems = [], anonymizeOut = false, write, log = () => {}, sleep = sleepReal, minGapMs = 1100 }) {
  const manifest = { capturedAt: new Date().toISOString(), base, anonymized: anonymizeOut, files: [], problems: [] };
  let lastAt = 0;
  const call = async (name, path) => {
    const wait = lastAt + minGapMs - Date.now(); if (wait > 0) await sleep(wait); lastAt = Date.now();
    const r = await request(fetchFn, `${base}/api/v1${path}`, { sleep });
    manifest.files.push({ file: name, endpoint: path, result: r.kind, status: r.status ?? null });
    if (r.kind !== "ok") { manifest.problems.push(`${name}: ${r.kind}${r.status ? ` (${r.status})` : ""}`); log(`  ${name}: ${r.kind}`); }
    else log(`  ${name}: ok`);
    return r;
  };
  const priv = { username: player, ids: [] };
  const save = (name, data) => write(name, anonymizeOut ? anonymize(data, priv) : data);

  const market = await call("market.json", "/market"); if (market.kind === "ok") save("market.json", market.data);
  const jobs = await call("jobs.json", "/jobs"); if (jobs.kind === "ok") save("jobs.json", jobs.data);
  const trades = await call("all-trades.json", "/market/trades?limit=100"); if (trades.kind === "ok") save("all-trades.json", trades.data);

  const byName = await call("by-name.json", `/players/by-name/${encodeURIComponent(player)}`);
  if (byName.kind !== "ok") { manifest.stopped = byName.kind === "missing" ? "player-not-found" : `player-lookup-${byName.kind}`; return manifest; }
  let profile = rec(byName.data).id ? rec(byName.data) : rec(rec(byName.data).player);
  const pid = profile.id; priv.ids.push(pid, profile.regionId);
  save("by-name.json", byName.data);
  if (!Array.isArray(profile.skills) || profile.skills.length === 0) {
    const full = await call("profile.json", `/players/${encodeURIComponent(pid)}`);
    if (full.kind === "ok") { save("profile.json", full.data); profile = rec(full.data).id ? rec(full.data) : rec(rec(full.data).player); }
  }
  manifest.skillsFound = Array.isArray(profile.skills) && profile.skills.length > 0;

  const list = await call("player-companies.json", `/players/${encodeURIComponent(pid)}/companies?sort=level&limit=12`);
  const ids = [];
  if (list.kind === "ok") { save("player-companies.json", list.data); for (const c of rec(list.data).companies ?? []) if (typeof rec(c).id === "string") ids.push(c.id); }
  const items = new Set(extraItems);
  let n = 0;
  for (const cid of ids.slice(0, maxCompanies)) {
    n++; priv.ids.push(cid);
    const c = await call(`company-${n}.json`, `/companies/${encodeURIComponent(cid)}`);
    if (c.kind === "ok") { save(`company-${n}.json`, c.data); if (typeof rec(c.data).itemCode === "string") items.add(c.data.itemCode); }
  }
  if (profile.regionId) { const r = await call("region.json", `/regions/${encodeURIComponent(profile.regionId)}`); if (r.kind === "ok") { save("region.json", r.data); const cc = rec(r.data).countryId; if (cc) { const co = await call("country.json", `/countries/${encodeURIComponent(cc)}`); if (co.kind === "ok") save("country.json", co.data); } } }
  if (items.size === 0 && market.kind === "ok") items.add(itemCodesOf(market.data).includes("concrete") ? "concrete" : itemCodesOf(market.data)[0]);
  for (const it of items) {
    if (!it) continue;
    const o = await call(`orders-${it}.json`, `/market/${it}/orders`); if (o.kind === "ok") save(`orders-${it}.json`, o.data);
    const h = await call(`history-${it}.json`, `/market/${it}/history?hours=168`); if (h.kind === "ok") save(`history-${it}.json`, h.data);
    const t = await call(`trades-${it}.json`, `/market/${it}/trades?limit=100`); if (t.kind === "ok") save(`trades-${it}.json`, t.data);
  }
  manifest.items = [...items];
  return manifest;
}
