"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Re-runs the server render, which re-requests data through the data layer. */
export function RetryButton({ label = "Try again" }: { label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn" disabled={pending} onClick={() => start(() => router.refresh())}>
      {pending ? "Retrying…" : label}
    </button>
  );
}
