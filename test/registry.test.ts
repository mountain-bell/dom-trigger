import { describe, expect, it, vi } from "vitest";
import { trigger } from "./setup";

describe("ハンドラーの登録と解除", () => {
	it("同じ名前で再登録すると新しいハンドラーだけを実行する", async () => {
		const previous = vi.fn();
		const current = vi.fn();
		trigger.use("open-menu", previous);
		trigger.use("open-menu", current);
		await trigger.run("open-menu");
		expect(previous).not.toHaveBeenCalled();
		expect(current).toHaveBeenCalledOnce();
	});
	it("unuseは指定したハンドラーだけを解除する", async () => {
		const removed = vi.fn();
		const kept = vi.fn();
		trigger.use("removed", removed);
		trigger.use("kept", kept);
		trigger.unuse("removed");
		trigger.unuse("missing");
		await trigger.run("removed");
		await trigger.run("kept");
		expect(removed).not.toHaveBeenCalled();
		expect(kept).toHaveBeenCalledOnce();
	});
	it("clearはすべてのハンドラーを解除し、後から再登録できる", async () => {
		const old = vi.fn();
		const next = vi.fn();
		trigger.use("first", old);
		trigger.use("second", old);
		trigger.clear();
		await trigger.run("first");
		await trigger.run("second");
		trigger.use("first", next);
		await trigger.run("first");
		expect(old).not.toHaveBeenCalled();
		expect(next).toHaveBeenCalledOnce();
	});
	it.each([
		"",
		"Bad",
		"two_words",
		"two words",
		"-name",
		"name-",
		"two--words",
		"1name",
	])("不正な名前「%s」を各APIで拒否する", async (name) => {
		expect(() => trigger.use(name, vi.fn())).toThrow(
			"Invalid trigger name"
		);
		expect(() => trigger.unuse(name)).toThrow("Invalid trigger name");
		await expect(trigger.run(name)).rejects.toThrow("Invalid trigger name");
		await expect(trigger.invoke(name, document.body)).rejects.toThrow(
			"Invalid trigger name"
		);
	});
	it.each([
		"load",
		"pageshow",
		"visibilitychange",
		"pagehide",
		"offline",
		"online",
		"click",
		"submit",
		"change",
		"input",
		"focusin",
		"focusout",
		"pointerdown",
		"pointermove",
		"pointerup",
		"pointercancel",
		"transitionend",
		"animationend",
		"copy",
		"paste",
		"keydown",
		"keyup",
		"mouseover",
		"mouseout",
		"viewin",
		"viewout",
		"prevent-default",
		"stop-propagation",
		"view-ratio",
		"uncache",
	])("予約語%sと、その語にハイフンを続けた名前は登録できない", (name) => {
		expect(() => trigger.use(name, vi.fn())).toThrow(
			"Reserved trigger name"
		);
		expect(() => trigger.use(`${name}-action`, vi.fn())).toThrow(
			"Reserved trigger name"
		);
	});
	it.each(["open-menu", "clickable", "a1", "step-2"])(
		"有効な名前%sで登録・実行できる",
		async (name) => {
			const handler = vi.fn();
			trigger.use(name, handler);
			await trigger.run(name);
			expect(handler).toHaveBeenCalledOnce();
		}
	);
	it("default exportとnamed exportで同じAPIを利用できる", async () => {
		const api = await import("../src/index");
		for (const name of [
			"use",
			"run",
			"invoke",
			"listen",
			"observeView",
			"unuse",
			"clear",
			"setup",
			"setupOnReady",
		] as const)
			expect(api[name]).toBe(trigger[name]);
	});
});

describe("runとinvoke", () => {
	it("runは指定した要素・データ・イベントをそのまま渡す", async () => {
		const handler = vi.fn();
		const el = document.createElement("div");
		el.setAttribute("data-action", '{"from":"attribute"}');
		const data = { from: "options" };
		const event = new Event("click");
		trigger.use("action", handler);
		await trigger.run("action", { el, data, event });
		expect(handler).toHaveBeenCalledWith({
			el,
			data,
			ctx: { name: "action", source: "run", event },
		});
		expect(handler.mock.calls[0][0].data).toBe(data);
	});
	it("runのoptionsを省略すると要素とデータなしで実行する", async () => {
		const handler = vi.fn();
		trigger.use("action", handler);
		await trigger.run("action");
		expect(handler).toHaveBeenCalledWith({
			el: undefined,
			data: undefined,
			ctx: { name: "action", source: "run", event: undefined },
		});
	});
	it.each(["run", "invoke"] as const)(
		"%sは未登録の名前なら何も実行しない",
		async (method) => {
			document.body.setAttribute("data-missing", "invalid json");
			await expect(
				method === "run"
					? trigger.run("missing")
					: trigger.invoke("missing", document.body)
			).resolves.toBeUndefined();
		}
	);
	it.each(["run", "invoke"] as const)(
		"%sはハンドラーのPromiseが完了するまで待つ",
		async (method) => {
			let resolve!: () => void;
			const pending = new Promise<void>((done) => {
				resolve = done;
			});
			trigger.use("action", () => pending);
			let finished = false;
			const result =
				method === "run"
					? trigger.run("action")
					: trigger.invoke("action", document.body);
			const completion = result.then(() => {
				finished = true;
			});
			await Promise.resolve();
			expect(finished).toBe(false);
			resolve();
			await completion;
			expect(finished).toBe(true);
		}
	);
	it.each(["run", "invoke"] as const)(
		"%sの呼び出し元で同期例外とPromise拒否を受け取れる",
		async (method) => {
			const error = new Error("handler failed");
			const execute = () =>
				method === "run"
					? trigger.run("action")
					: trigger.invoke("action", document.body);
			trigger.use("action", () => {
				throw error;
			});
			await expect(execute()).rejects.toBe(error);
			trigger.use("action", () => Promise.reject(error));
			await expect(execute()).rejects.toBe(error);
		}
	);
});
