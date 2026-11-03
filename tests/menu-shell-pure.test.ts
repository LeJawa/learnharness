import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeMenuPlacement, type MenuSide } from "../components/menu-shell.tsx";

/**
 * The shared menu shell's placement decision (fix wave chunk B): the
 * pure math behind every dropdown's anchoring — side preference, the
 * honest-fit flip, the 60vh cap, alignment. The DOM effects (portal,
 * measure-then-show, re-placement on scroll/resize) are live-verified;
 * this pins the geometry.
 */

const rect = (top: number, bottom: number) => ({ top, bottom, left: 100, right: 300 });
const viewport = (height: number) => ({ width: 1280, height });

describe("computeMenuPlacement — side", () => {
	it("keeps the preferred side when it shows the whole menu", () => {
		for (const preferred of ["up", "down"] as MenuSide[]) {
			const p = computeMenuPlacement(rect(400, 440), viewport(800), 300, preferred, "right");
			assert.equal(p.side, preferred);
		}
	});

	it("flips when the preferred side cannot hold the content and the other is roomier", () => {
		// Anchor 30px above the viewport bottom: down has ~2px of room,
		// up has ~380. A 300px menu must flip UP despite preferring down.
		const p = computeMenuPlacement(rect(770, 800), viewport(800), 300, "down", "right");
		assert.equal(p.side, "up");
		// ...and mirrors: an anchor at the very top preferring up flips down.
		const q = computeMenuPlacement(rect(0, 30), viewport(800), 300, "up", "right");
		assert.equal(q.side, "down");
	});

	it("stays put when neither side fits better (the roomier side already preferred)", () => {
		// Short viewport: down has 450, up has 200 — a 600px menu stays
		// down (capped gracefully) because up is NOT roomier.
		const p = computeMenuPlacement(rect(150, 190), viewport(650), 600, "down", "right");
		assert.equal(p.side, "down");
	});

	it("nothing measured yet (contentHeight ≤ 0) keeps the preferred side", () => {
		const p = computeMenuPlacement(rect(770, 800), viewport(800), 0, "down", "right");
		assert.equal(p.side, "down");
	});
});

describe("computeMenuPlacement — cap + position", () => {
	it("caps at 60vh when the side has more room than that", () => {
		// Anchor high: 648px below it — more than 60vh(480) → the cap is 60vh.
		const p = computeMenuPlacement(rect(100, 140), viewport(800), 300, "down", "right");
		assert.equal(p.maxHeight, 0.6 * 800);
		assert.equal(p.style.top, 144); // anchor bottom + GAP(4)
		assert.equal(p.style.right, 1280 - 300); // right-aligned to the anchor
	});

	it("caps at the side's available room when 60vh exceeds it", () => {
		// Anchor at 500/800: down room = 800 − 8 − 544 = 248 < 480. The
		// short content (100) fits down — no flip — so the cap binds at 248.
		const p = computeMenuPlacement(rect(500, 540), viewport(800), 100, "down", "right");
		assert.equal(p.side, "down");
		assert.equal(p.maxHeight, 248);
	});

	it("never crushes below the usability floor, even against a tiny side", () => {
		// Anchor 30px above the bottom, both sides thin: capped to the
		// floor, not a 2px sliver — the cap overflows rather than crushes.
		const p = computeMenuPlacement(rect(30, 60), viewport(90), 300, "down", "right");
		assert.equal(p.maxHeight, 96);
	});

	it("up-side menus anchor their BOTTOM above the anchor's top", () => {
		const p = computeMenuPlacement(rect(400, 440), viewport(800), 300, "up", "right");
		assert.equal(p.style.bottom, 800 - 400 + 4); // viewport − anchor.top − GAP
		assert.ok(!("top" in p.style));
	});

	it("left alignment keys off the anchor's left edge", () => {
		const p = computeMenuPlacement(rect(400, 440), viewport(800), 300, "down", "left");
		assert.equal(p.style.left, 100);
		assert.ok(!("right" in p.style));
	});
});
describe("computeMenuPlacement — phone width (2026-11)", () => {
	const phone = { width: 390, height: 844 };

	it("every menu is capped to the viewport (edge to edge minus the 8px gutters)", () => {
		const p = computeMenuPlacement({ top: 100, bottom: 140, left: 300, right: 380 }, phone, 300, "down", "right", 352);
		assert.equal(p.style.maxWidth, 390 - 16);
	});

	it("a right-aligned menu stays inside the right edge", () => {
		const p = computeMenuPlacement({ top: 100, bottom: 140, left: 300, right: 380 }, phone, 300, "down", "right", 352);
		assert.equal(p.style.right, 10);
		// 390 − 10 − min(352, 374) = 28 → on screen.
		assert.ok((p.style.right as number) + Math.min(352, 374) <= 390);
	});

	it("a LEFT-aligned menu is clamped against its measured width", () => {
		// Anchored mid-screen: 200 + 374 would hang 184px past the edge.
		const p = computeMenuPlacement({ top: 100, bottom: 140, left: 200, right: 300 }, phone, 300, "down", "left", 352);
		assert.equal(p.style.left, 390 - 8 - 352);
	});

	it("left alignment is untouched when it already fits (desktop)", () => {
		const p = computeMenuPlacement({ top: 100, bottom: 140, left: 100, right: 300 }, { width: 1280, height: 800 }, 300, "down", "left", 352);
		assert.equal(p.style.left, 100);
	});
});
