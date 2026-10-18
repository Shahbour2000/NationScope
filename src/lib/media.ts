import { ITEM_ICON_BASE } from "@/lib/config/environments";

const MEDIA_PATH = /^\/media\/[A-Za-z0-9._/-]+$/;
const ITEM_CODE = /^[A-Za-z0-9_-]{1,40}$/;

/** "/media/x.webp" returned by the API -> absolute URL on the API origin. Anything else (other hosts, traversal) is rejected. */
export function mediaSrc(path: string | null | undefined, origin: string): string | null {
  if (!path || !MEDIA_PATH.test(path) || path.split("/").some((s) => s === ".." || s === ".")) return null;
  return `${origin}${path}`;
}

export function itemIconSrc(code: string): string | null {
  return ITEM_CODE.test(code) ? `${ITEM_ICON_BASE}/${code}.webp` : null;
}
