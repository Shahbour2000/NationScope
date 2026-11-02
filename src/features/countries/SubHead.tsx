import { Tabs, type TabItem } from "@/components/Tabs";
import { countryName, type Display } from "@/features/entities/display";
import { Flag } from "@/features/entities/entities";
import s from "./sub.module.css";

/** Shared heading for country sub-pages: flag, "Country · Section" and the country tab bar. */
export function SubHead({ id, title, tabs, d }: { id: string; title: string; tabs: TabItem[]; d: Display }) {
  return (
    <>
      <div className={s.head}><Flag id={id} d={d} /><h1>{countryName(id, d.dir)} · {title}</h1></div>
      <Tabs items={tabs} label={title} />
    </>
  );
}
