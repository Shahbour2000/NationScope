import { StateMessage } from "@/components/StateMessage";
import { getLocale, getMessages } from "@/i18n";

export default async function BuildPlannerPage() {
  const m = (await getMessages(await getLocale())).planner;
  return (
    <>
      <h1>{m.title}</h1>
      <StateMessage tone="empty" title={m.status} detail={m.statusDetail} />

      <section className="panel" style={{ marginBlock: "1rem" }} aria-labelledby="needs">
        <h2 id="needs" style={{ fontSize: "1.05rem", marginTop: 0 }}>{m.inputsTitle}</h2>
        <div className="tablewrap">
          <table className="table">
            <thead><tr><th scope="col">{m.colInput}</th><th scope="col">{m.colUse}</th><th scope="col">{m.colStatus}</th></tr></thead>
            <tbody>
              {m.inputs.map((r) => (
                <tr key={r.name}><td>{r.name}</td><td>{r.use}</td><td>{r.status}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" style={{ marginBlock: "1rem" }} aria-labelledby="built">
        <h2 id="built" style={{ fontSize: "1.05rem", marginTop: 0 }}>{m.builtTitle}</h2>
        <ul>{m.built.map((b) => <li key={b}>{b}</li>)}</ul>
      </section>

      <section className="panel" aria-labelledby="unlock">
        <h2 id="unlock" style={{ fontSize: "1.05rem", marginTop: 0 }}>{m.unlockTitle}</h2>
        <p style={{ marginTop: 0 }} dir="auto">{m.unlock}</p>
        <p className="note">{m.honesty}</p>
      </section>
    </>
  );
}
