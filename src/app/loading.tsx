export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading">
      <div className="skeleton" style={{ inlineSize: "40%" }} />
      <div className="skeleton" />
      <div className="skeleton" style={{ inlineSize: "75%" }} />
    </div>
  );
}
