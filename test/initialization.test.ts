import { beforeEach, describe, expect, it, vi } from "vitest";
import { trigger } from "./setup";
import {
	entry,
	installIntersectionObserver,
	observer,
} from "./intersection-observer.mock";

beforeEach(() => {
	installIntersectionObserver();
	document.body.innerHTML =
		'<button class="js-click-action js-viewin-visible" data-click-stop-propagation></button>';
});

describe("setup", () => {
	it("通常イベントとVIEW監視を開始し、繰り返しても重複実行しない", () => {
		const handler = vi.fn();
		trigger.use("action", handler);
		trigger.use("visible", handler);
		trigger.setup();
		trigger.setup();
		const el = document.body.firstElementChild!;
		el.dispatchEvent(new Event("click", { bubbles: true }));
		observer().emit(entry(el, 1));
		expect(handler.mock.calls.map(([args]) => args.ctx.name)).toEqual([
			"action",
			"visible",
		]);
	});
	it("IntersectionObserver非対応でもイベントを処理し、VIEW監視の呼び出しごとに警告する", () => {
		vi.stubGlobal("IntersectionObserver", undefined);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const handler = vi.fn();
		trigger.use("action", handler);
		trigger.setup();
		trigger.observeView();
		document.body.firstElementChild!.dispatchEvent(
			new Event("click", { bubbles: true })
		);
		expect(handler).toHaveBeenCalledOnce();
		expect(warn).toHaveBeenCalledTimes(2);
		expect(warn.mock.calls[0][0]).toContain(
			"IntersectionObserver is unavailable"
		);
	});
});

describe("setupOnReadyの実行順", () => {
	it.each(["interactive", "complete"] as const)(
		"readyState=%sならbefore・初期化・afterを同期実行する",
		(state) => {
			vi.spyOn(document, "readyState", "get").mockReturnValue(state);
			const order: string[] = [];
			trigger.setupOnReady({
				before: () => {
					order.push("before");
					document.body.firstElementChild!.classList.add(
						"js-viewin-extra"
					);
				},
				after: () => {
					expect(
						observer().targets.has(document.body.firstElementChild!)
					).toBe(true);
					order.push("after");
				},
			});
			expect(order).toEqual(["before", "after"]);
		}
	);
	it("読み込み中ならDOMContentLoadedまで待ち、一度だけ初期化する", () => {
		vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
		const before = vi.fn();
		const after = vi.fn();
		const handler = vi.fn();
		trigger.use("action", handler);
		trigger.setupOnReady({ before, after });
		const el = document.body.firstElementChild!;
		el.dispatchEvent(new Event("click", { bubbles: true }));
		expect(before).not.toHaveBeenCalled();
		expect(after).not.toHaveBeenCalled();
		expect(handler).not.toHaveBeenCalled();
		document.dispatchEvent(new Event("DOMContentLoaded"));
		document.dispatchEvent(new Event("DOMContentLoaded"));
		expect(before).toHaveBeenCalledOnce();
		expect(after).toHaveBeenCalledOnce();
		el.dispatchEvent(new Event("click", { bubbles: true }));
		expect(handler).toHaveBeenCalledOnce();
	});
	it.each(["省略", "beforeのみ", "afterのみ", "両方"])(
		"optionsが%sでも監視を開始する",
		(pattern) => {
			vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
			const before = vi.fn();
			const after = vi.fn();
			const options =
				pattern === "省略"
					? undefined
					: {
							before:
								pattern === "afterのみ" ? undefined : before,
							after: pattern === "beforeのみ" ? undefined : after,
						};
			trigger.setupOnReady(options);
			expect(
				observer().targets.has(document.body.firstElementChild!)
			).toBe(true);
			expect(before).toHaveBeenCalledTimes(
				pattern === "beforeのみ" || pattern === "両方" ? 1 : 0
			);
			expect(after).toHaveBeenCalledTimes(
				pattern === "afterのみ" || pattern === "両方" ? 1 : 0
			);
		}
	);
	it("beforeで登録した外部リスナーは実行し、afterで登録したものは停止属性で止める", () => {
		vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
		const order: string[] = [];
		trigger.use("action", () => {
			order.push("trigger");
		});
		trigger.setupOnReady({
			before: () => {
				document.addEventListener("click", () => {
					order.push("before");
				});
			},
			after: () => {
				document.addEventListener("click", () => {
					order.push("after");
				});
			},
		});
		document.body.firstElementChild!.dispatchEvent(
			new Event("click", { bubbles: true })
		);
		expect(order).toEqual(["before", "trigger"]);
	});
	it("コールバックのPromise完了を待たずに初期化を続ける", async () => {
		vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
		const order: string[] = [];
		let finish!: () => void;
		const pending = new Promise<void>((resolve) => {
			finish = resolve;
		});
		const completion = pending.then(() => {
			order.push("finished");
		});
		trigger.setupOnReady({
			before: () => completion,
			after: () => {
				order.push("after");
			},
		});
		expect(order).toEqual(["after"]);
		finish();
		await completion;
		expect(order).toEqual(["after", "finished"]);
	});
});

describe("setupOnReadyのエラー処理", () => {
	it.each([
		["complete", "before"],
		["complete", "setup"],
		["complete", "after"],
		["loading", "before"],
		["loading", "setup"],
		["loading", "after"],
	] as const)(
		"readyState=%sで%sが失敗したら以降を中止してonErrorへ渡す",
		(state, phase) => {
			vi.spyOn(document, "readyState", "get").mockReturnValue(state);
			const error = new Error("initialization failed");
			const order: string[] = [];
			const onError = vi.fn();
			if (phase === "setup")
				vi.stubGlobal(
					"IntersectionObserver",
					class {
						constructor() {
							throw error;
						}
					}
				);
			trigger.setupOnReady({
				before: () => {
					order.push("before");
					if (phase === "before") throw error;
				},
				after: () => {
					order.push("after");
					if (phase === "after") throw error;
				},
				onError,
			});
			if (state === "loading") {
				expect(onError).not.toHaveBeenCalled();
				document.dispatchEvent(new Event("DOMContentLoaded"));
			}
			expect(onError).toHaveBeenCalledExactlyOnceWith(error);
			expect(order).toEqual(
				phase === "after" ? ["before", "after"] : ["before"]
			);
		}
	);
	it("即時初期化でonErrorがなければ呼び出し元へ例外を返す", () => {
		vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
		const error = new Error("before failed");
		expect(() =>
			trigger.setupOnReady({
				before: () => {
					throw error;
				},
			})
		).toThrow(error);
	});
});
