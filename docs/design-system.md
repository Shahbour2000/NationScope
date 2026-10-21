# Design system

Tokens live at the top of `src/app/globals.css` (`:root`): colours (`--bg`, `--surface*`, `--line*`, `--ink`, `--muted`), brand (`--brand-purple`, `--brand-blue`, `--brand-cyan`, `--magenta`, `--grad`), spacing (`--space-1..6`), radii, shadows, sizes (`--sidebar-w`, `--topbar-h`, `--tap` = 44px touch target) and fonts. Breakpoints (media queries cannot read variables): phone <= 40rem, drawer/cards <= 48rem, desktop above.

Brand: "Nation" white, "Scope" purple -> blue -> cyan; magenta only for the pin count and pinned state. Logo mark: `public/brand/logo-mark.png` (extracted from the supplied artwork), live wordmark in `src/components/Logo.tsx`, icons in `src/app/icon.png`, `apple-icon.png`, `opengraph-image.png`.

Rules: logical CSS properties only (RTL-safe); no hover-only information (use `<details>`/tap); interactive controls >= 44px on phones; tables become stacked cards below 48rem with a sort select (`MobileSort`); status colours come from badge tones, not ad-hoc colours; respect `prefers-reduced-motion`.
