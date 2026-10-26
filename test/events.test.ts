import { describe, expect, it, vi } from "vitest";
import { trigger } from "./setup";

function fire(target: EventTarget, type = "click") {
	const event = new Event(type, { bubbles: true, cancelable: true });
	target.dispatchEvent(event);
	return event;
}

describe("イベント委譲", () => {
	it.each([
		"click",
		"submit",
		"change",
		"input",
		"focusin",
		"focusout",
		"pointerdown",
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
	])("%sは対象のハンドラーに要素・データ・イベントを渡す", (type) => {
		document.body.innerHTML = `<div class="js-${type}-action" data-action='{"count":1}'></div>`;
		const el = document.body.firstElementChild!;
		const handler = vi.fn();
		trigger.use("action", handler);
		trigger.listen();
		const event = fire(el, type);
		expect(handler).toHaveBeenCalledExactlyOnceWith({
			el,
			data: { count: 1 },
			ctx: { name: "action", source: "invoke", event },
		});
	});
	it("内側から親へ、同じ要素ではclassの記述順に実行する", () => {
		document.body.innerHTML =
			'<div class="js-click-outer"><button class="js-click-first js-click-second"><span></span></button></div>';
		const order: string[] = [];
		for (const name of ["outer", "first", "second"])
			trigger.use(name, () => {
				order.push(name);
			});
		trigger.listen();
		fire(document.querySelector("span")!);
		expect(order).toEqual(["first", "second", "outer"]);
	});
	it("空白文字で区切ったclassを読み、重複・不正名・別イベント・接頭辞の部分一致を実行しない", () => {
		const el = document.createElement("div");
		el.className =
			"js-click-first\tjs-click-second\njs-click-first js-click-BAD js-click- xjs-click-third js-input-third";
		document.body.append(el);
		const order: string[] = [];
		for (const name of ["first", "second", "third"])
			trigger.use(name, () => {
				order.push(name);
			});
		trigger.listen();
		fire(el);
		expect(order).toEqual(["first", "second"]);
	});
	it("listen後に追加した要素も処理し、listenを繰り返しても重複実行しない", () => {
		const handler = vi.fn();
		trigger.use("action", handler);
		trigger.listen();
		trigger.listen();
		document.body.innerHTML = '<button class="js-click-action"></button>';
		fire(document.body.firstElementChild!);
		expect(handler).toHaveBeenCalledOnce();
	});
	it("clear後に再登録してもイベント監視を開始し直す必要はない", () => {
		document.body.innerHTML = '<button class="js-click-action"></button>';
		const old = vi.fn();
		const next = vi.fn();
		trigger.use("action", old);
		trigger.listen();
		trigger.clear();
		fire(document.body.firstElementChild!);
		trigger.use("action", next);
		fire(document.body.firstElementChild!);
		expect(old).not.toHaveBeenCalled();
		expect(next).toHaveBeenCalledOnce();
	});
	it("要素を差し替えてもlistenの再実行なしで新しい要素のデータを渡す", () => {
		const handler = vi.fn();
		trigger.use("action", handler);
		trigger.listen();
		document.body.innerHTML =
			'<button class="js-click-action" data-action=\'{"value":"old"}\'></button>';
		fire(document.body.firstElementChild!);
		document.body.innerHTML =
			'<button class="js-click-action" data-action=\'{"value":"new"}\'></button>';
		const next = document.body.firstElementChild!;
		fire(next);
		expect(handler.mock.calls.map(([args]) => args.data)).toEqual([
			{ value: "old" },
			{ value: "new" },
		]);
		expect(handler.mock.calls[1][0].el).toBe(next);
	});
	it("非同期ハンドラーの完了を待たず次のハンドラーを呼ぶ", async () => {
		document.body.innerHTML =
			'<button class="js-click-first js-click-second"></button>';
		const order: string[] = [];
		let finish!: () => void;
		const pending = new Promise<void>((resolve) => {
			finish = resolve;
		});
		const completion = pending.then(() => {
			order.push("finished");
		});
		trigger.use("first", () => {
			order.push("first");
			return completion;
		});
		trigger.use("second", () => {
			order.push("second");
		});
		trigger.listen();
		fire(document.body.firstElementChild!);
		expect(order).toEqual(["first", "second"]);
		finish();
		await completion;
		expect(order).toEqual(["first", "second", "finished"]);
	});
});

describe("イベントの抑止と停止", () => {
	it.each([
		[null, false],
		["false", false],
		["", true],
		["true", true],
	] as const)(
		"prevent-default=%sではdefaultPreventedが%sになる",
		(value, expected) => {
			document.body.innerHTML =
				'<button class="js-click-action"></button>';
			const el = document.body.firstElementChild!;
			if (value !== null)
				el.setAttribute("data-click-prevent-default", value);
			const handler = vi.fn();
			trigger.use("action", handler);
			trigger.listen();
			expect(fire(el).defaultPrevented).toBe(expected);
			expect(handler).toHaveBeenCalledOnce();
		}
	);
	it("親要素のprevent-defaultも適用する", () => {
		document.body.innerHTML =
			'<div class="js-click-outer" data-click-prevent-default><button class="js-click-inner"></button></div>';
		trigger.listen();
		expect(fire(document.querySelector("button")!).defaultPrevented).toBe(
			true
		);
	});
	it("停止属性は同じ要素の全ハンドラーを実行してから親と後続の外部リスナーを止める", () => {
		document.body.innerHTML =
			'<div class="js-click-outer"><button class="js-click-first js-click-second" data-click-stop-propagation></button></div>';
		const order: string[] = [];
		document.addEventListener("click", () => {
			order.push("earlier");
		});
		for (const name of ["first", "second", "outer"])
			trigger.use(name, () => {
				order.push(name);
			});
		trigger.listen();
		document.addEventListener("click", () => {
			order.push("later");
		});
		window.addEventListener("click", () => {
			order.push("window");
		});
		fire(document.querySelector("button")!);
		expect(order).toEqual(["earlier", "first", "second"]);
	});
	it("stop-propagation=falseなら親と後続の外部リスナーも実行する", () => {
		document.body.innerHTML =
			'<div class="js-click-outer"><button class="js-click-inner" data-click-stop-propagation="false"></button></div>';
		const order: string[] = [];
		for (const name of ["inner", "outer"])
			trigger.use(name, () => {
				order.push(name);
			});
		trigger.listen();
		document.addEventListener("click", () => {
			order.push("later");
		});
		fire(document.querySelector("button")!);
		expect(order).toEqual(["inner", "outer", "later"]);
	});
	it("有効なトリガークラスがなければ抑止属性だけでは処理しない", () => {
		document.body.innerHTML =
			'<button class="js-click-BAD" data-click-prevent-default data-click-stop-propagation></button>';
		const listener = vi.fn();
		trigger.listen();
		document.addEventListener("click", listener);
		expect(fire(document.body.firstElementChild!).defaultPrevented).toBe(
			false
		);
		expect(listener).toHaveBeenCalledOnce();
	});
});

describe("ページイベントとポインター追跡", () => {
	it.each([
		"load",
		"pageshow",
		"pagehide",
		"online",
		"offline",
		"visibilitychange",
	])("%sはbodyのトリガーを実行する", (type) => {
		document.body.className = `js-${type}-action`;
		document.body.innerHTML = `<div class="js-${type}-action"></div>`;
		const handler = vi.fn();
		trigger.use("action", handler);
		trigger.listen();
		const event = fire(
			type === "visibilitychange" ? document : window,
			type
		);
		expect(handler).toHaveBeenCalledExactlyOnceWith({
			el: document.body,
			data: {},
			ctx: { name: "action", source: "invoke", event },
		});
	});
	it.each(["pointerup", "pointercancel"])(
		"トリガーのない場所でpointerdownした後もmoveを処理し、%sで終了する",
		(endEvent) => {
			document.body.innerHTML = '<div class="js-pointermove-drag"></div>';
			const el = document.body.firstElementChild!;
			const handler = vi.fn();
			trigger.use("drag", handler);
			trigger.listen();
			fire(el, "pointermove");
			expect(handler).not.toHaveBeenCalled();
			fire(document.body, "pointerdown");
			fire(el, "pointermove");
			expect(handler).toHaveBeenCalledOnce();
			fire(document.body, endEvent);
			fire(el, "pointermove");
			expect(handler).toHaveBeenCalledOnce();
		}
	);
});
