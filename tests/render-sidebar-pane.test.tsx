import React from "react";
(globalThis as Record<string, unknown>).React = React;

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SidebarPane } from "../components/sidebar.tsx";

/**
 * The left pane's two geometries (phone pass 2026-11). Wide is the original
 * inline column, byte-for-byte in spirit: no role, no scrim, width-animated.
 * Narrow is a MODAL DRAWER: dialog semantics, scrim, and a closed state that
 * is out of the tab order (aria-hidden + inert).
 */

function render(drawer: boolean, open: boolean) {
	return renderToStaticMarkup(
		<SidebarPane drawer={drawer} open={open} onClose={() => {}}>
			<span>body</span>
		</SidebarPane>,
	);
}

describe("SidebarPane — wide stays the inline column", () => {
	it("open: width-animated, no dialog semantics, no scrim", () => {
		const html = render(false, true);
		assert.ok(html.includes('data-testid="sidebar"'));
		assert.ok(html.includes("w-72"));
		assert.ok(!html.includes('role="dialog"'));
		assert.ok(!html.includes("sidebar-scrim"));
		assert.ok(!html.includes("inert"));
	});

	it("closed: zero width, hidden from assistive tech", () => {
		const html = render(false, false);
		assert.ok(html.includes('data-testid="sidebar"'));
		assert.ok(html.includes("w-0"));
		assert.ok(html.includes('aria-hidden="true"'));
		assert.ok(!html.includes('role="dialog"'));
		assert.ok(!html.includes("sidebar-scrim"));
	});
});

describe("SidebarPane — narrow is a modal drawer", () => {
	it("open: dialog semantics, scrim present, on screen", () => {
		const html = render(true, true);
		assert.ok(html.includes('data-testid="sidebar-drawer"'));
		assert.ok(html.includes('role="dialog"'));
		assert.ok(html.includes('aria-modal="true"'));
		assert.ok(html.includes('aria-label="Sessions"'));
		assert.ok(html.includes("translate-x-0"));
		assert.ok(!html.includes("-translate-x-full"));
		assert.ok(html.includes('data-testid="sidebar-scrim"'));
		assert.ok(!html.includes("inert"));
	});

	it("closed: off screen AND out of reach (aria-hidden + inert)", () => {
		const html = render(true, false);
		assert.ok(html.includes("-translate-x-full"));
		assert.ok(html.includes('aria-hidden="true"'));
		assert.ok(html.includes("inert"));
		assert.ok(!html.includes("sidebar-scrim"), "no scrim for a closed drawer");
	});

	it("the drawer caps its width so a phone keeps a strip of content visible", () => {
		const html = render(true, true);
		assert.ok(html.includes("w-[min(18rem,85vw)]"));
	});

	it("the drawer respects the safe-area top inset (notch)", () => {
		const html = render(true, true);
		assert.ok(html.includes("pt-[var(--lh-safe-top)]"));
	});
});
