import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { getDisplay } from "@/features/entities/display.server";
import { BattlesBoard, type HistoryInfo } from "@/features/wars/BattlesBoard";
import { parseRange, windowBattles } from "@/features/wars/history";
import { getLocale, getMessages } from "@/i18n";
import { getBattleHistory, getBattles } from "@/lib/data/world";

export const dynamic = "force-dynamic";


export default async function BattlesPage({ searchParams }: { searchParams: Promise<{ view?: string; range?: string }> }) {
  const sp = await searchParams;
  const view = sp.view === "history" ? "history" : "live";
  const range = parseRange(sp.range);
  const m = getMessages(await getLocale());
  const nowMs = Date.now();
  let rows, meta, history: HistoryInfo | null = null;
  try {
    if (view === "history") {
      const h = await getBattleHistory();
      const w = windowBattles(h.rows, range, nowMs, h.exhausted);
      rows = w.rows;
      history = { requested: h.limit, returned: h.rows.length, covered: w.covered, oldestMs: w.oldestMs };
      meta = h.meta;
    } else {
      const r = await getBattles("active");
      rows = r.rows; meta = r.meta;
    }
  } catch (e) { return <ApiErrorState error={e} retryLabel={m.common.retry} />; }
  const d = await getDisplay();
  return (
    <>
      <div className="page-head"><h1><Icon name="battle" size={26} />{m.battlesPage.title}</h1></div>
      <p style={{ color: "#8b97b3", margin: "-0.3rem 0 1.4rem", maxInlineSize: "62rem" }}>{m.battlesPage.intro}</p>
      <BattlesBoard rows={rows} view={view} range={range} history={history} d={d} m={m.battlesPage} nowMs={nowMs} />
      <Provenance meta={meta} m={m} />
    </>
  );
}
