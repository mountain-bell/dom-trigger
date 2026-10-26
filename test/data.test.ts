import { describe, expect, it, vi } from "vitest";
import { trigger } from "./setup";

describe("invokeのdata属性", () => {
	it("dataを書き換えると、次回の呼び出しにも同じオブジェクトの変更が残る", async () => {
		const el = document.createElement("div");
		el.setAttribute("data-action", '{"count":1}');
		const counts: unknown[] = [];
		trigger.use<{ count: number }>("action", ({ data }) => {
			counts.push(data?.count);
			if (data) data.count++;
		});
		await trigger.invoke("action", el);
		await trigger.invoke("action", el);
		expect(counts).toEqual([1, 2]);
		expect(el.getAttribute("data-action")).toBe('{"count":1}');
	});
	it.each(["clear", "unuse"] as const)(
		"%s後に再登録してもキャッシュは残り、uncache属性で最新値を読める",
		async (method) => {
			const el = document.createElement("div");
			el.setAttribute("data-action", '{"count":1}');
			trigger.use("action", () => {});
			await trigger.invoke("action", el);
			if (method === "clear") trigger.clear();
			else trigger.unuse("action");
			el.setAttribute("data-action", '{"count":2}');
			const handler = vi.fn();
			trigger.use("action", handler);
			await trigger.invoke("action", el);
			expect(handler.mock.calls[0][0].data).toEqual({ count: 1 });
			el.setAttribute("data-uncache-action", '{"count":3}');
			await trigger.invoke("action", el);
			expect(handler.mock.calls[1][0].data).toEqual({ count: 3 });
			el.removeAttribute("data-uncache-action");
			await trigger.invoke("action", el);
			expect(handler.mock.calls[2][0].data).toEqual({ count: 1 });
		}
	);
	it("指定要素のJSONとイベントをinvokeのコンテキストで渡す", async () => {
		const handler = vi.fn();
		const el = document.createElement("button");
		const event = new Event("click");
		el.setAttribute(
			"data-action",
			'{"count":2,"enabled":true,"items":["a"],"nested":{"value":null}}'
		);
		trigger.use("action", handler);
		await trigger.invoke("action", el, event);
		expect(handler).toHaveBeenCalledWith({
			el,
			data: {
				count: 2,
				enabled: true,
				items: ["a"],
				nested: { value: null },
			},
			ctx: { name: "action", source: "invoke", event },
		});
	});
	it.each([null, ""])(
		"属性が%sなら空のデータを渡し、後で設定した値を読み取れる",
		async (value) => {
			const handler = vi.fn();
			const el = document.createElement("div");
			if (value !== null) el.setAttribute("data-action", value);
			trigger.use("action", handler);
			await trigger.invoke("action", el);
			expect(handler.mock.calls[0][0].data).toEqual({});
			el.setAttribute("data-action", '{"count":1}');
			await trigger.invoke("action", el);
			expect(handler.mock.calls[1][0].data).toEqual({ count: 1 });
		}
	);
	it("通常のdata属性は初回の値をキャッシュする", async () => {
		const handler = vi.fn();
		const el = document.createElement("div");
		trigger.use("action", handler);
		el.setAttribute("data-action", '{"count":1}');
		await trigger.invoke("action", el);
		el.setAttribute("data-action", '{"count":2}');
		await trigger.invoke("action", el);
		expect(handler.mock.calls.map(([args]) => args.data)).toEqual([
			{ count: 1 },
			{ count: 1 },
		]);
	});
	it("キャッシュは要素とハンドラー名ごとに独立する", async () => {
		const handler = vi.fn();
		const first = document.createElement("div");
		const second = document.createElement("div");
		first.setAttribute("data-action", '{"value":1}');
		first.setAttribute("data-other", '{"value":2}');
		second.setAttribute("data-action", '{"value":3}');
		trigger.use("action", handler);
		trigger.use("other", handler);
		await trigger.invoke("action", first);
		await trigger.invoke("other", first);
		await trigger.invoke("action", second);
		expect(handler.mock.calls.map(([args]) => args.data)).toEqual([
			{ value: 1 },
			{ value: 2 },
			{ value: 3 },
		]);
	});
	it("uncache属性は通常属性やキャッシュより優先し、毎回最新の値を読む", async () => {
		const handler = vi.fn();
		const el = document.createElement("div");
		trigger.use("action", handler);
		el.setAttribute("data-action", '{"count":1}');
		await trigger.invoke("action", el);
		el.setAttribute("data-uncache-action", '{"count":2}');
		await trigger.invoke("action", el);
		el.setAttribute("data-uncache-action", '{"count":3}');
		await trigger.invoke("action", el);
		expect(handler.mock.calls.map(([args]) => args.data)).toEqual([
			{ count: 1 },
			{ count: 2 },
			{ count: 3 },
		]);
	});
	it("空のuncache属性でも通常属性にはフォールバックしない", async () => {
		const handler = vi.fn();
		const el = document.createElement("div");
		el.setAttribute("data-action", '{"count":1}');
		el.setAttribute("data-uncache-action", "");
		trigger.use("action", handler);
		await trigger.invoke("action", el);
		expect(handler.mock.calls[0][0].data).toEqual({});
	});
	it.each(["data-action", "data-uncache-action"])(
		"%sの不正なJSONは属性名を含むエラーになり、ハンドラーを実行しない",
		async (attribute) => {
			const handler = vi.fn();
			const el = document.createElement("div");
			el.setAttribute(attribute, "{broken}");
			trigger.use("action", handler);
			await expect(trigger.invoke("action", el)).rejects.toThrow(
				`Invalid JSON in ${attribute}`
			);
			expect(handler).not.toHaveBeenCalled();
			el.setAttribute(attribute, '{"fixed":true}');
			await trigger.invoke("action", el);
			expect(handler.mock.calls[0][0].data).toEqual({ fixed: true });
		}
	);
});
