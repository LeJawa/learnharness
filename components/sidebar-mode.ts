/**
 * Left-pane layout decisions — pure, so the responsive rule can be pinned
 * by tests without a DOM.
 *
 * ONE RULE FOR EVERY HOST (owner decision, phone pass 2026-11): the pane is
 * an inline column only when the window can hold the content floor (640px)
 * PLUS the pane itself (288px); below that it is an OVERLAY DRAWER. This
 * retires the Electron-only auto-close era: the web build had no narrow
 * behavior at all, so a phone browser rendered a 288px column next to
 * ~100px of content, and opening it while narrow called an Electron IPC
 * that does not exist in a browser.
 *
 * Two different states own the pane, and neither may clobber the other:
 *  - `pref`   — the PERSISTED user choice (localStorage). Wide windows
 *               render it; toggling wide writes it.
 *  - `drawer` — the transient narrow-window flag. It is never persisted
 *               and resets to closed on every entry into narrow, so a
 *               drawer never pops open by itself on a phone.
 */

/** 640px content floor + 288px pane (w-72) = 928px. Mirrors
 *  SIDEBAR_AUTOCLOSE in electron/main.cjs (the window floor rationale). */
export const SIDEBAR_INLINE_MIN = 928;

/** The media query the client listens on. The 0.02px shim keeps a
 *  fractional-width viewport (zoom) on the same side as the integer
 *  comparison below (`< 928`), matching the Tailwind 927.98px idiom. */
export const NARROW_MEDIA_QUERY = `(max-width: ${SIDEBAR_INLINE_MIN - 0.02}px)`;

export type SidebarMode = "inline" | "drawer";

/** The mode for a viewport width (px). Pure — `sidebarModeFor(927)` is a
 *  drawer, `sidebarModeFor(928)` is inline. */
export function sidebarModeFor(viewportWidth: number): SidebarMode {
	return sidebarModeForNarrow(viewportWidth < SIDEBAR_INLINE_MIN);
}

/** The mode the client applies from its media query. Same rule as
 *  `sidebarModeFor`, expressed as the boolean matchMedia already has. */
export function sidebarModeForNarrow(narrow: boolean): SidebarMode {
	return narrow ? "drawer" : "inline";
}

/** Which state owns the rendered pane. Wide: the persisted preference.
 *  Narrow: the transient drawer flag (a phone must not inherit the
 *  desktop's "open" preference). */
export function sidebarRendersOpen(
	mode: SidebarMode,
	prefOpen: boolean,
	drawerOpen: boolean,
): boolean {
	return mode === "drawer" ? drawerOpen : prefOpen;
}
