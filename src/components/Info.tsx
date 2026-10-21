import type { ReactNode } from "react";

/** Tap-friendly explanation (a native disclosure works on touch, unlike hover tooltips). */
export function Info({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="info">
      <summary>{title}</summary>
      <div>{children}</div>
    </details>
  );
}
