import { beforeEach, describe, expect, it, vi } from "vitest";
import { trigger } from "./setup";
import {
	entry,
	installIntersectionObserver,
	observer,
	TestIntersectionObserver,
} from "./intersection-observer.mock";

beforeEach(installIntersectionObserver);

function viewElement() {
	const el = document.createElement("div");
	el.className = "js-viewin-enter js-viewout-leave";
	document.body.append(el);
	return el;
}

describe("VIEWの登録と状態変化", () => {
	it("有効なVIEWクラスだけを監視し、再実行しても重複登録しない", () => {
		document.body.innerHTML =
			'<div class="js-viewin-enter"></div><div class="js-viewout-leave"></div><div class="xjs-viewin-enter"></div><div class="js-viewin-BAD"></div><div class="js-click-action"></div>';
		const expected = Array.from(document.body.children).slice(0, 2);
		trigger.observeView();
		trigger.observeView();
		expect(TestIntersectionObserver.instances).toHaveLength(1);
		expect(observer().observed).toEqual(expected);
		expect(observer().thresholds).toEqual([
			0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1,
		]);
	});
	it("初回outと同じ状態の繰り返しを実行せず、inとoutの切り替わりで実行する", () => {
		const el = viewElement();
		const enter = vi.fn();
		const leave = vi.fn();
		trigger.use("enter", enter);
		trigger.use("leave", leave);
		trigger.observeView();
		observer().emit(entry(el, 0));
		expect(leave).not.toHaveBeenCalled();
		observer().emit(entry(el, 1), entry(el, 0.5));
		expect(enter).toHaveBeenCalledExactlyOnceWith({
			el,
			data: {},
			ctx: { name: "enter", source: "invoke", event: undefined },
		});
		observer().emit(entry(el, 0), entry(el, 0));
		expect(leave).toHaveBeenCalledOnce();
		observer().emit(entry(el, 1));
		expect(enter).toHaveBeenCalledTimes(2);
	});
	it("複数ハンドラーをclass順で実行し、データを渡す", () => {
		const el = viewElement();
		el.className = "js-viewin-first\tjs-viewin-second\njs-viewin-first";
		el.setAttribute("data-first", '{"value":1}');
		const calls: unknown[] = [];
		trigger.use("first", ({ data }) => {
			calls.push(["first", data]);
		});
		trigger.use("second", ({ data }) => {
			calls.push(["second", data]);
		});
		trigger.observeView();
		observer().emit(entry(el, 1));
		expect(calls).toEqual([
			["first", { value: 1 }],
			["second", {}],
		]);
	});
	it.each([
		[null, 0, true, true],
		["0.3", 0.3, true, true],
		["0.3", 0.29, true, false],
		["1", 0.99, true, false],
		["1", 1, true, true],
		["0", 1, false, false],
		["0.35", 0.35, true, true],
		["0.35", 0.34, true, false],
		["-1", 0.1, true, true],
		["2", 0.1, true, true],
		["invalid", 0.1, true, true],
	] as const)(
		"ratio=%s・表示割合=%s・交差=%sならin判定は%sになる",
		(ratio, visible, intersecting, expected) => {
			const el = viewElement();
			if (ratio !== null) el.setAttribute("data-view-ratio", ratio);
			const handler = vi.fn();
			trigger.use("enter", handler);
			trigger.observeView();
			observer().emit(entry(el, visible, intersecting));
			expect(handler).toHaveBeenCalledTimes(expected ? 1 : 0);
		}
	);
	it("指定割合を下回ると、まだ交差していてもoutになる", () => {
		const el = viewElement();
		el.setAttribute("data-view-ratio", "0.5");
		const leave = vi.fn();
		trigger.use("leave", leave);
		trigger.observeView();
		observer().emit(entry(el, 0.5), entry(el, 0.4));
		expect(leave).toHaveBeenCalledOnce();
	});
});

describe("VIEW監視の更新", () => {
	it("追加した要素はobserveViewで監視を始め、継続対象の状態は維持する", () => {
		const first = viewElement();
		const handler = vi.fn();
		trigger.use("enter", handler);
		trigger.observeView();
		observer().emit(entry(first, 1));
		const second = viewElement();
		expect(observer().targets.has(second)).toBe(false);
		trigger.observeView();
		expect(observer().targets.has(second)).toBe(true);
		observer().emit(entry(first, 1), entry(second, 1));
		expect(handler.mock.calls.map(([args]) => args.el)).toEqual([
			first,
			second,
		]);
	});
	it.each(["DOMから削除", "VIEWクラスを削除"])(
		"%sした対象の監視を解除し、解除だけではoutを実行しない",
		(operation) => {
			const el = viewElement();
			const leave = vi.fn();
			trigger.use("leave", leave);
			trigger.observeView();
			observer().emit(entry(el, 1));
			if (operation === "DOMから削除") el.remove();
			else el.className = "js-click-action";
			trigger.observeView();
			expect(observer().targets.has(el)).toBe(false);
			observer().emit(entry(el, 0));
			expect(leave).not.toHaveBeenCalled();
		}
	);
	it("解除した要素の再登録は新しい表示状態として判定する", () => {
		const el = viewElement();
		const enter = vi.fn();
		const leave = vi.fn();
		trigger.use("enter", enter);
		trigger.use("leave", leave);
		trigger.observeView();
		observer().emit(entry(el, 1));
		el.remove();
		trigger.observeView();
		document.body.append(el);
		trigger.observeView();
		observer().emit(entry(el, 0));
		expect(leave).not.toHaveBeenCalled();
		observer().emit(entry(el, 1));
		expect(enter).toHaveBeenCalledTimes(2);
	});
	it("clearはVIEW監視と表示状態を解除しない", () => {
		const el = viewElement();
		trigger.observeView();
		observer().emit(entry(el, 1));
		trigger.clear();
		const leave = vi.fn();
		trigger.use("leave", leave);
		observer().emit(entry(el, 0));
		expect(leave).toHaveBeenCalledOnce();
		expect(observer().targets.has(el)).toBe(true);
	});
});

describe("再監視時の古いVIEW結果", () => {
	it("監視解除した対象の保留結果を捨て、継続対象の結果は実行する", async () => {
		const removed = viewElement();
		const kept = viewElement();
		const handler = vi.fn();
		trigger.use("enter", handler);
		trigger.observeView();
		observer().pending = [entry(removed, 1), entry(kept, 1)];
		removed.remove();
		trigger.observeView();
		await Promise.resolve();
		expect(handler.mock.calls.map(([args]) => args.el)).toEqual([kept]);
	});
	it("保留結果の処理前に解除・再登録された対象には古い結果を実行しない", async () => {
		const removed = viewElement();
		const renewed = viewElement();
		const handler = vi.fn();
		trigger.use("enter", handler);
		trigger.observeView();
		observer().pending = [entry(renewed, 1)];
		removed.remove();
		trigger.observeView();
		renewed.remove();
		trigger.observeView();
		document.body.append(renewed);
		trigger.observeView();
		await Promise.resolve();
		expect(handler).not.toHaveBeenCalled();
		observer().emit(entry(renewed, 1));
		expect(handler).toHaveBeenCalledOnce();
	});
	it("先のハンドラーで後続の対象を解除・再登録したら、同じ一括結果の古い情報を実行しない", () => {
		const first = viewElement();
		const renewed = viewElement();
		const calls: Element[] = [];
		trigger.use("enter", ({ el }) => {
			calls.push(el!);
			if (el !== first) return;
			renewed.remove();
			trigger.observeView();
			document.body.append(renewed);
			trigger.observeView();
		});
		trigger.observeView();
		observer().emit(entry(first, 1), entry(renewed, 1));
		expect(calls).toEqual([first]);
		observer().emit(entry(renewed, 1));
		expect(calls).toEqual([first, renewed]);
	});
	it("ハンドラー内で自分を解除・再登録したら、旧登録の後続ハンドラーを実行しない", () => {
		const el = viewElement();
		el.className = "js-viewin-first js-viewin-second";
		const calls: string[] = [];
		let renewed = false;
		trigger.use("first", () => {
			calls.push("first");
			if (renewed) return;
			renewed = true;
			el.className = "";
			trigger.observeView();
			el.className = "js-viewin-first js-viewin-second";
			trigger.observeView();
		});
		trigger.use("second", () => {
			calls.push("second");
		});
		trigger.observeView();
		observer().emit(entry(el, 1));
		expect(calls).toEqual(["first"]);
		observer().emit(entry(el, 1));
		expect(calls).toEqual(["first", "first", "second"]);
	});
});
