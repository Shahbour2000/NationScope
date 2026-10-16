import type { ReactNode } from "react";

interface Props {
  tone: "error" | "empty";
  title: string;
  detail: string;
  action?: ReactNode;
}

/** Shared error / empty presentation. Pure and safe to render on server or client. */
export function StateMessage({ tone, title, detail, action }: Props) {
  return (
    <section className="state" data-tone={tone} role={tone === "error" ? "alert" : "status"}>
      <h2>{title}</h2>
      <p>{detail}</p>
      {action}
    </section>
  );
}
