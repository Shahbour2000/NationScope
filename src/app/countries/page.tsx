import { ApiErrorState } from "@/components/ApiErrorState";
import { Icon } from "@/components/Icon";
import { Provenance } from "@/components/Provenance";
import { CountriesBoard } from "@/features/countries/CountriesBoard";
import { getDisplay } from "@/features/entities/display.server";
import { getLocale, getMessages } from "@/i18n";
import { getCountries } from "@/lib/data/world";

export const dynamic = "force-dynamic";

export default async function CountriesPage() {
  const m = getMessages(await getLocale());
  let result;
  try { result = await getCountries(); } catch (e) { return <ApiErrorState error={e} retryLabel={m.common.retry} />; }
  const d = await getDisplay();
  return (
    <>
      <div className="page-head"><h1><Icon name="flag" size={26} />{m.countriesPage.title}</h1></div>
      <p style={{ color: "#8b97b3", margin: "-0.3rem 0 1.2rem", maxInlineSize: "62rem" }}>{m.countriesPage.intro}</p>
      <CountriesBoard rows={result.countries} d={d} m={m.countriesPage} />
      {result.skipped > 0 && <p className="banner" role="status">{result.skipped} {m.units.skipped}</p>}
      <Provenance meta={result.meta} m={m} />
    </>
  );
}
