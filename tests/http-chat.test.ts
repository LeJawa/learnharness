import assert from "node:assert/strict";
import { it } from "node:test";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { SessionModel } from "../components/session-core.ts";
import { newMessageId, newPlanBlockMessage } from "../src/core/native-messages.ts";

it("sends a question and adopts the reply without secure-context crypto APIs", async () => {
	const descriptor = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
	Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
	try {
		const requests: string[] = [];
		const messages = [
			{ id: "user-1", role: "user", content: "Hello", timestamp: 1 },
			{ ...fauxAssistantMessage("Hello back"), id: "assistant-1" },
		];
		const model = new SessionModel({
			chatId: "http-chat",
			initialMessages: [],
			fetch: async (url, init) => {
				requests.push(String(url));
				if (String(url) === "/api/chat") {
					assert.deepEqual(JSON.parse(String(init?.body)), {
						chatId: "http-chat", input: { type: "text", text: "Hello" },
					});
					return Response.json({ ok: true });
				}
				if (String(url) === "/api/chats/http-chat") return Response.json({ messages, turnInFlight: false });
				if (String(url) === "/api/chats/http-chat/stream") return new Response(
					'data: {"type":"turn-settled"}\n\ndata: [DONE]\n\n',
					{ headers: { "Content-Type": "text/event-stream" } },
				);
				throw new Error(`Unexpected request: ${url}`);
			},
		});
		assert.equal(await model.send({ type: "text", text: "Hello" }), true);
		assert.ok(requests.includes("/api/chat"));
		assert.equal(model.getState().status, "ready");
		assert.equal(model.getState().error, null);
		assert.deepEqual(model.getState().nativeMessages, messages);
		assert.match(newMessageId(), /^msg_[a-z0-9]+_[a-f0-9]{8}$/);
		assert.match(newPlanBlockMessage("plan-1", {}).id, /^pb_[a-z0-9]+_[a-f0-9]{8}$/);
	} finally {
		if (descriptor) Object.defineProperty(crypto, "randomUUID", descriptor);
		else Reflect.deleteProperty(crypto, "randomUUID");
	}
});

it("reports an optimistic message construction failure instead of staying submitted", async (t) => {
	t.mock.method(crypto, "getRandomValues", () => { throw new Error("Randomness unavailable"); });
	let requests = 0;
	const model = new SessionModel({
		chatId: "http-chat",
		initialMessages: [],
		fetch: async () => { requests++; return Response.json({ error: "Unexpected request" }, { status: 500 }); },
	});
	assert.equal(await model.send({ type: "text", text: "Hello" }), false);
	assert.equal(requests, 0);
	assert.equal(model.getState().status, "error");
	assert.equal(model.getState().error?.message, "Randomness unavailable");
});
