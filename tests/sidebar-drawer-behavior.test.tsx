import React from "react";
(globalThis as Record<string, unknown>).React = React;

import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { act } from "react";
import type { Root } from "react-dom/client";
import { parseHTML } from "linkedom";
import { SidebarPane, SidebarProvider, useSidebar } from "../components/sidebar.tsx";

/**
 * The drawer state machine, mounted (phone pass 2026-11).
 *
 * The old narrow rule was Electron-only, so a phone browser got the inline
 * 288px column and the toggle called a desktop IPC. These tests mount the
 * real provider with a narrow matchMedia and hold the client behavior:
 *  - narrow always ENTERS closed (the wide preference is not inherited),
 *  - the toggle opens the OVERLAY (scrim + dialog), never the inline column,
 *  - wide is untouched: the persisted preference owns the inline pane.
 */

function Probe() {
	const { open, drawer, toggle, close } = useSidebar();
	return (
		<div>
			<button type="button" data-testid="probe-toggle" onClick={toggle}>
				toggle
			</button>
			<SidebarPane drawer={drawer} open={open} onClose={close}>
				<span>body</span>
			</SidebarPane>
		</div>
	);
}

describe("SidebarProvider — narrow is a drawer", () => {
	const dom = parseHTML("<html><body></body></html>");
	const globals = globalThis as Record<string, unknown>;
	const previous = new Map<string, PropertyDescriptor | undefined>();
	let createRoot: typeof import("react-dom/client").createRoot;
	let root: Root | null = null;
	let host: HTMLElement;

	before(async () => {
		for (const [key, value] of Object.entries({
			window: dom.window,
			document: dom.document,
			navigator: { userAgent: "test", platform: "", maxTouchPoints: 5 },
			HTMLElement: dom.window.HTMLElement,
			IS_REACT_ACT_ENVIRONMENT: true,
		})) {
			previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
			Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
		}
		({ createRoot } = await import("react-dom/client"));
	});

	after(() => {
		for (const [key, descriptor] of previous) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else delete globals[key];
		}
	});

	afterEach(async () => {
		if (root) await act(async () => root!.unmount());
		root = null;
	});

	async function mount(narrow: boolean) {
		// The stored preference says OPEN (the desktop choice a phone must not
		// inherit). matchMedia decides the mode.
		(dom.window as unknown as { localStorage: unknown }).localStorage = {
			getItem: () => "1",
			setItem: () => {},
		};
		(dom.window as unknown as { matchMedia: unknown }).matchMedia = (query: string) => ({
			matches: narrow,
			media: query,
			addEventListener: () => {},
			removeEventListener: () => {},
		});
		host = dom.document.createElement("div") as HTMLElement;
		dom.document.body.appendChild(host);
		root = createRoot(host);
		await act(async () => root!.render(<SidebarProvider><Probe /></SidebarProvider>));
	}

	const q = (s: string) => dom.document.querySelector(s);

	it("narrow enters CLOSED even though the stored preference is open", async () => {
		await mount(true);
		assert.ok(q('[data-testid="sidebar-drawer"]'), "the overlay pane");
		assert.equal(q('[data-testid="sidebar"]'), null, "never the inline column");
		assert.equal(q('[data-testid="sidebar-scrim"]'), null, "closed: no scrim");
		assert.ok(
			q('[data-testid="sidebar-drawer"]')!.className.includes("-translate-x-full"),
			"off screen",
		);
	});

	it("the toggle opens the overlay with its scrim", async () => {
		await mount(true);
		await act(async () => (q('[data-testid="probe-toggle"]') as HTMLElement).click());
		assert.ok(q('[data-testid="sidebar-scrim"]'), "the modal boundary");
		assert.ok(
			q('[data-testid="sidebar-drawer"]')!.className.includes("translate-x-0"),
			"on screen",
		);
	});

	it("wide keeps the inline column and the stored preference", async () => {
		await mount(false);
		const pane = q('[data-testid="sidebar"]');
		assert.ok(pane, "the inline column");
		assert.equal(q('[data-testid="sidebar-drawer"]'), null, "no overlay");
		assert.ok(pane!.className.includes("w-72"), "open per the stored preference");
		await act(async () => (q('[data-testid="probe-toggle"]') as HTMLElement).click());
		assert.ok(q('[data-testid="sidebar"]')!.className.includes("w-0"), "toggled closed");
	});
});
