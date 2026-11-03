import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createChatGPT } = require("../electron/chatgpt.cjs");

/**
 * Regression (deployment incident, 2026-11-03): models() used to call
 * notify() unconditionally in its catch block. A PERMANENT failure — an
 * unwritable credential store, the classic case being a server deployment
 * whose AUTH_FILE directory is not writable — therefore re-broadcast
 * subscriptions-changed on every single call. The browser answers that
 * event by refetching /api/subscriptions and /api/models (settings-signal
 * "keys"), and /api/models calls models() again: an endless fetch loop at
 * network speed that also cleared the client's catalog cache on every turn,
 * so the model picker never left its loading state.
 *
 * The write path itself is covered elsewhere (chatgpt-file-store.test.ts).
 * This pins the BROADCAST contract only: a failure state is news once.
 */
interface Push {
	invalidate: string;
	status: { error: string | null; available: boolean };
}

const storageFailure = () => Object.assign(new Error("storage"), { code: "storage" });

test("a persistent credential-store failure is broadcast once, never on every catalog call", async () => {
	const pushes: Push[] = [];
	const connection = createChatGPT({
		// read() rejects exactly like fileStore does for a non-ENOENT failure
		// (EACCES on an unlucky deploy): a storage-coded failure, permanently.
		store: {
			read: async () => {
				throw storageFailure();
			},
			write: async () => {
				throw storageFailure();
			},
		},
		openExternal: () => assert.fail("no browser sign-in expected"),
		fetch: () => assert.fail("no provider request expected"),
		onChange: (push: Push) => {
			pushes.push(push);
		},
	});
	try {
		// First call: the storage denial is published (invalidate "all"), and so
		// is the first catalog failure — both are genuine transitions.
		await connection.models();
		assert.equal(pushes.length, 2, "storage denial + first catalog failure are both published");
		assert.equal(pushes[0]?.invalidate, "all");
		assert.match(String(pushes.at(-1)?.status.error), /credentials could not be read or saved/);

		// The failure is visible, not swallowed: the status surface still reports it.
		const status = await connection.status();
		assert.equal(status.available, false);
		assert.match(String(status.error), /credentials could not be read or saved/);

		// Repeated calls re-observe the SAME permanent failure: no new broadcast.
		await connection.models();
		await connection.models();
		assert.equal(pushes.length, 2, "identical repeated failures must not re-notify (client refetch loop)");
	} finally {
		connection.close();
	}
});
