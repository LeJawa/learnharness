/**
 * Long-press → context menu (phone pass, owner decision 2026-11).
 *
 * The app's row/graph menus have always been right-click. Touch has no
 * right-click, so those actions were simply unreachable on a phone. This
 * is the one gesture recognizer both surfaces share: a 500ms press that
 * never travels more than 10px. Mouse pointers are excluded on purpose —
 * desktop keeps exactly its existing right-click behavior.
 *
 * The controller is framework-free and timer-injectable so tests can pin
 * the gesture machine without a DOM (tests/long-press.test.ts).
 */

export const LONG_PRESS_DELAY = 500;
export const LONG_PRESS_SLOP = 10;

export interface PressPoint {
	pointerId: number;
	clientX: number;
	clientY: number;
}

export interface PressInput extends PressPoint {
	pointerType?: string;
	isPrimary?: boolean;
	button?: number;
}

/** Only a primary touch/pen press starts a long press. Mouse presses
 *  never do: right-click owns the desktop menu. */
export function beginsLongPress(input: PressInput): boolean {
	return (
		input.pointerType !== "mouse" &&
		(input.isPrimary ?? true) &&
		(input.button ?? 0) === 0
	);
}

/** Movement that still counts as a press (scrolls and drags exceed it). */
export function withinSlop(
	origin: { clientX: number; clientY: number },
	point: { clientX: number; clientY: number },
	slop = LONG_PRESS_SLOP,
): boolean {
	return (
		Math.abs(point.clientX - origin.clientX) <= slop &&
		Math.abs(point.clientY - origin.clientY) <= slop
	);
}

export interface LongPressGesture {
	/** Begin watching a press (no-op for mouse or non-primary presses). */
	down(input: PressInput): void;
	/** Feed movement; leaving the slop cancels (a scroll is not a press). */
	move(point: PressPoint): void;
	/** The press ended. True when the long press already fired — the caller
	 *  consumes it to suppress the compatibility click that follows. */
	up(): boolean;
	cancel(): void;
}

/**
 * @param onFire Called once, at the press origin, when the delay elapses
 *               without movement.
 */
export function createLongPress(
	onFire: (point: { clientX: number; clientY: number }) => void,
	options: { delay?: number; slop?: number } = {},
): LongPressGesture {
	const delay = options.delay ?? LONG_PRESS_DELAY;
	const slop = options.slop ?? LONG_PRESS_SLOP;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let origin: { clientX: number; clientY: number } | null = null;
	let pointerId: number | null = null;
	/** Set when the timer fires; consumed by the next `up()`. */
	let fired = false;

	const clear = () => {
		if (timer !== null) clearTimeout(timer);
		timer = null;
	};

	const reset = () => {
		clear();
		origin = null;
		pointerId = null;
	};

	return {
		down(input) {
			if (timer !== null) {
				// A second pointer is a multi-touch gesture (pinch), never a
				// press — cancel rather than restart on the new finger.
				if (pointerId !== input.pointerId) {
					reset();
					fired = false;
				}
				return;
			}
			fired = false;
			if (!beginsLongPress(input)) return;
			pointerId = input.pointerId;
			origin = { clientX: input.clientX, clientY: input.clientY };
			timer = setTimeout(() => {
				timer = null;
				if (!origin) return;
				fired = true;
				onFire({ ...origin });
			}, delay);
		},
		move(point) {
			// After the fire the press is over as a gesture: movement belongs
			// to whatever the menu does, and must not eat the suppression.
			if (timer === null || !origin || point.pointerId !== pointerId) return;
			if (!withinSlop(origin, point, slop)) reset();
		},
		up() {
			const alreadyFired = fired;
			reset();
			fired = false;
			return alreadyFired;
		},
		cancel() {
			reset();
			fired = false;
		},
	};
}
