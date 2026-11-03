import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
	beginsLongPress,
	createLongPress,
	LONG_PRESS_DELAY,
	withinSlop,
} from "../components/long-press.ts";

/**
 * The long-press recognizer (phone pass 2026-11): right-click menus were
 * unreachable on touch. These pins hold the gesture law — press, don't
 * move, don't be a mouse — so a scroll can never open a menu.
 */

const touch = (overrides: Record<string, unknown> = {}) => ({
	pointerId: 1,
	clientX: 100,
	clientY: 100,
	pointerType: "touch",
	isPrimary: true,
	button: 0,
	...overrides,
});

describe("which presses may become a long press", () => {
	it("primary touch and pen presses do; mouse never does (right-click owns desktop)", () => {
		assert.equal(beginsLongPress(touch()), true);
		assert.equal(beginsLongPress(touch({ pointerType: "pen" })), true);
		assert.equal(beginsLongPress(touch({ pointerType: "mouse" })), false);
	});

	it("secondary pointers and non-primary buttons are not presses", () => {
		assert.equal(beginsLongPress(touch({ isPrimary: false })), false);
		assert.equal(beginsLongPress(touch({ button: 2 })), false);
	});

	it("the slop is inclusive and axis-independent", () => {
		assert.equal(withinSlop({ clientX: 0, clientY: 0 }, { clientX: 10, clientY: 0 }), true);
		assert.equal(withinSlop({ clientX: 0, clientY: 0 }, { clientX: 0, clientY: 10 }), true);
		assert.equal(withinSlop({ clientX: 0, clientY: 0 }, { clientX: 11, clientY: 0 }), false);
	});
});

describe("the gesture machine", () => {
	it("fires once after the delay when the finger stays put", () => {
		mock.timers.enable({ apis: ["setTimeout"] });
		try {
			const fired: { clientX: number; clientY: number }[] = [];
			const press = createLongPress((p) => fired.push(p));
			press.down(touch());

			mock.timers.tick(LONG_PRESS_DELAY - 1);
			assert.equal(fired.length, 0, "not before the delay");
			mock.timers.tick(1);
			assert.deepEqual(fired, [{ clientX: 100, clientY: 100 }], "fires at the press origin");
			mock.timers.tick(LONG_PRESS_DELAY * 2);
			assert.equal(fired.length, 1, "once, never repeating");
		} finally {
			mock.timers.reset();
		}
	});

	it("up() reports the fire so the caller can suppress the compatibility click", () => {
		mock.timers.enable({ apis: ["setTimeout"] });
		try {
			const press = createLongPress(() => {});
			press.down(touch());
			mock.timers.tick(LONG_PRESS_DELAY);
			assert.equal(press.up(), true);
			assert.equal(press.up(), false, "one-shot: the next press is ordinary");
		} finally {
			mock.timers.reset();
		}
	});

	it("movement beyond the slop cancels (a scroll is not a press)", () => {
		mock.timers.enable({ apis: ["setTimeout"] });
		try {
			const fired: unknown[] = [];
			const press = createLongPress((p) => fired.push(p));
			press.down(touch());
			press.move({ pointerId: 1, clientX: 100, clientY: 140 });
			mock.timers.tick(LONG_PRESS_DELAY * 2);
			assert.deepEqual(fired, []);
			assert.equal(press.up(), false);
		} finally {
			mock.timers.reset();
		}
	});

	it("a second pointer (pinch) cancels instead of restarting the clock", () => {
		mock.timers.enable({ apis: ["setTimeout"] });
		try {
			const fired: unknown[] = [];
			const press = createLongPress((p) => fired.push(p));
			press.down(touch());
			mock.timers.tick(200);
			press.down(touch({ pointerId: 2, clientX: 300 }));
			mock.timers.tick(LONG_PRESS_DELAY * 2);
			assert.deepEqual(fired, []);
		} finally {
			mock.timers.reset();
		}
	});

	it("a mouse press never arms the timer", () => {
		mock.timers.enable({ apis: ["setTimeout"] });
		try {
			const fired: unknown[] = [];
			const press = createLongPress((p) => fired.push(p));
			press.down(touch({ pointerType: "mouse" }));
			mock.timers.tick(LONG_PRESS_DELAY * 2);
			assert.deepEqual(fired, []);
			assert.equal(press.up(), false);
		} finally {
			mock.timers.reset();
		}
	});

	it("cancel() clears a pending press", () => {
		mock.timers.enable({ apis: ["setTimeout"] });
		try {
			const fired: unknown[] = [];
			const press = createLongPress((p) => fired.push(p));
			press.down(touch());
			press.cancel();
			mock.timers.tick(LONG_PRESS_DELAY * 2);
			assert.deepEqual(fired, []);
		} finally {
			mock.timers.reset();
		}
	});

	it("movement from a different pointer never drives this press", () => {
		mock.timers.enable({ apis: ["setTimeout"] });
		try {
			const fired: unknown[] = [];
			const press = createLongPress((p) => fired.push(p));
			press.down(touch());
			press.move({ pointerId: 9, clientX: 400, clientY: 400 });
			mock.timers.tick(LONG_PRESS_DELAY);
			assert.deepEqual(fired, [{ clientX: 100, clientY: 100 }]);
		} finally {
			mock.timers.reset();
		}
	});
});
