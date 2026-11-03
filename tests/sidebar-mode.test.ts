import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	NARROW_MEDIA_QUERY,
	SIDEBAR_INLINE_MIN,
	sidebarModeFor,
	sidebarModeForNarrow,
	sidebarRendersOpen,
} from "../components/sidebar-mode.ts";

/**
 * The left pane's responsive rule (phone pass 2026-11). These pins exist
 * because the old rule lived inside an Electron-only effect: the web build
 * had no narrow behavior, so a phone browser rendered the 288px column
 * beside ~100px of content. The mode rule is now pure and shared.
 */

describe("sidebar mode — one rule for every host", () => {
	it("the threshold is the content floor + the pane", () => {
		// 640px (the window floor the pane may never squeeze) + 288px (w-72).
		assert.equal(SIDEBAR_INLINE_MIN, 928);
	});

	it("narrow is < 928 — the drawer boundary is exact", () => {
		assert.equal(sidebarModeFor(390), "drawer"); // a phone
		assert.equal(sidebarModeFor(767), "drawer"); // a small tablet
		assert.equal(sidebarModeFor(927), "drawer");
		assert.equal(sidebarModeFor(928), "inline"); // exactly enough for both
		assert.equal(sidebarModeFor(1440), "inline");
	});

	it("the media query matches the same boundary (fractional shim)", () => {
		assert.equal(NARROW_MEDIA_QUERY, "(max-width: 927.98px)");
	});

	it("the matchMedia boolean maps to the width rule", () => {
		assert.equal(sidebarModeForNarrow(true), "drawer");
		assert.equal(sidebarModeForNarrow(false), "inline");
	});
});

describe("which state owns the rendered pane", () => {
	it("wide renders the persisted preference", () => {
		assert.equal(sidebarRendersOpen("inline", true, false), true);
		assert.equal(sidebarRendersOpen("inline", false, true), false);
	});

	it("narrow renders the transient drawer flag — the phone never inherits the desktop preference", () => {
		assert.equal(sidebarRendersOpen("drawer", true, false), false);
		assert.equal(sidebarRendersOpen("drawer", false, true), true);
	});
});
