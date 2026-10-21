/** Sort control for phones, where table headers (and their sort buttons) are replaced by stacked cards. */
export function MobileSort({ label, options, value, dir, onKey, onDir }: {
  label: string;
  options: { key: string; label: string }[];
  value: string;
  dir: "asc" | "desc";
  onKey: (key: string) => void;
  onDir: () => void;
}) {
  return (
    <div className="mobile-sort">
      <label>
        {label}
        <select className="field" value={value} onChange={(e) => onKey(e.target.value)}>
          {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </label>
      <button type="button" className="btn-ghost" onClick={onDir} aria-label={`${label}: ${dir === "asc" ? "ascending" : "descending"}`}>{dir === "asc" ? "▲" : "▼"}</button>
    </div>
  );
}
