"use client";

import { Icon } from "@/components/Icon";
import type { Messages } from "@/i18n/messages";
import type { PinType } from "./store";
import { usePins } from "./usePins";

export interface PinTarget { type: PinType; id: string; name: string; image: string | null; href: string }

/** Pin / unpin control for an entity page. aria-pressed reflects the saved state. */
export function PinButton({ target, labels }: { target: PinTarget; labels: Messages["pins"] }) {
  const { has, toggle } = usePins();
  const pinned = has(target.type, target.id);
  return (
    <button type="button" className="pinbtn" data-pinned={pinned} aria-pressed={pinned} onClick={() => toggle({ ...target, at: Date.now() })}>
      <Icon name={pinned ? "pinoff" : "pin"} size={16} />
      <span>{pinned ? labels.pinned : labels.pin}</span>
      <span className="sr-only" role="status">{pinned ? labels.added : labels.removed}</span>
    </button>
  );
}
