import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { getDisplay } from "@/features/entities/display.server";
import { JobsBoard } from "@/features/economy/JobsBoard";
import { getLocale, getMessages } from "@/i18n";
import { getJobs } from "@/lib/data/economy";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const m = getMessages(await getLocale());
  const e = m.economyPage;
  let res;
  try { res = await getJobs(); } catch (err) { return <ApiErrorState error={err} retryLabel={m.common.retry} />; }
  const d = await getDisplay();
  return (
    <>
      <div className="page-head"><h1><Icon name="briefcase" size={26} />{e.jobsTitle}</h1></div>
      <p className="note">{e.jobsIntro}</p>
      <JobsBoard rows={res.rows} d={d} m={m} wage={res.wage} />
      <p className="hint">{e.pricePerPoint}. {e.payNote}</p>
      <Provenance meta={res.meta} m={m} />
    </>
  );
}
