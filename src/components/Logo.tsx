/** NationScope brand: the supplied globe-and-orbit mark (public/brand/logo-mark.png) plus a live wordmark ("Nation" white, "Scope" gradient). */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="ns-mark" src="/brand/logo-mark.png" alt="" width={size} height={size} style={{ blockSize: size }} />
  );
}

export function Logo({ showWordmark = true }: { showWordmark?: boolean }) {
  return (
    <span className="ns-logo">
      <LogoMark />
      {showWordmark && <span className="ns-wordmark" dir="ltr">Nation<b>Scope</b></span>}
    </span>
  );
}
