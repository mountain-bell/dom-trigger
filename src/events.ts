import { hasTrigger, getTriggerNames } from "./utils";

export const JS_PREFIX = "js-";

type DomEventName =
	keyof HTMLElementEventMap | keyof DocumentEventMap | keyof WindowEventMap;

const EVENT_PREFIX_MAP: Partial<Record<DomEventName, string>> = {
	// --- ページ ---
	load: `${JS_PREFIX}load-`,
	pageshow: `${JS_PREFIX}pageshow-`,
	visibilitychange: `${JS_PREFIX}visibilitychange-`,
	pagehide: `${JS_PREFIX}pagehide-`,
	// --- ネットワーク ---
	offline: `${JS_PREFIX}offline-`,
	online: `${JS_PREFIX}online-`,
	// --- クリック ---
	click: `${JS_PREFIX}click-`,
	// --- フォーム ---
	submit: `${JS_PREFIX}submit-`,
	change: `${JS_PREFIX}change-`,
	input: `${JS_PREFIX}input-`,
	// --- フォーカス ---
	focusin: `${JS_PREFIX}focusin-`,
	focusout: `${JS_PREFIX}focusout-`,
	// --- ポインター ---
	pointerdown: `${JS_PREFIX}pointerdown-`,
	pointermove: `${JS_PREFIX}pointermove-`,
	pointerup: `${JS_PREFIX}pointerup-`,
	pointercancel: `${JS_PREFIX}pointercancel-`,
	// --- アニメーション ---
	transitionend: `${JS_PREFIX}transitionend-`,
	animationend: `${JS_PREFIX}animationend-`,
	// --- クリップボード ---
	copy: `${JS_PREFIX}copy-`,
	paste: `${JS_PREFIX}paste-`,
	// --- キーボード（クリック補助・PC向け） ---
	keydown: `${JS_PREFIX}keydown-`,
	keyup: `${JS_PREFIX}keyup-`,
	// --- マウス（ホバー演出・PC向け） ---
	mouseover: `${JS_PREFIX}mouseover-`,
	mouseout: `${JS_PREFIX}mouseout-`,
};

const WINDOW_EVENTS: Set<DomEventName> = new Set([
	"load",
	"pageshow",
	"pagehide",
	"offline",
	"online",
]);

const PAGE_LEVEL_EVENTS: Set<DomEventName> = new Set([
	"visibilitychange",
	...WINDOW_EVENTS,
]);

const EVENT_NAMES = Object.keys(EVENT_PREFIX_MAP);

const EVENT_PARAM_PREVENT_DEFAULT = "prevent-default";
const EVENT_PARAM_STOP_PROPAGATION = "stop-propagation";

export const RESERVED_EVENT_TRIGGER_NAMES = [
	...EVENT_NAMES,
	EVENT_PARAM_PREVENT_DEFAULT,
	EVENT_PARAM_STOP_PROPAGATION,
];

function collectTriggerElements(target: Element, prefix: string): Element[] {
	const results: Element[] = [];
	let current: Element | null = target;
	while (current) {
		if (hasTrigger(current, prefix)) {
			results.push(current);
		}
		current = current.parentElement;
	}
	return results;
}

export class EventListener {
	private boundEvents = new Set<string>();
	private isTrackingPointer = false;

	constructor(
		private readonly invoke: (
			name: string,
			el: Element,
			event?: Event
		) => Promise<void>
	) {}

	listen() {
		for (const eventName of EVENT_NAMES)
			this.registerEvent(eventName as DomEventName);
	}

	private registerEvent(eventName: DomEventName) {
		if (this.boundEvents.has(eventName)) return;
		this.boundEvents.add(eventName);

		const prefix = EVENT_PREFIX_MAP[eventName];
		if (!prefix) return;

		const eventTarget = WINDOW_EVENTS.has(eventName) ? window : document;

		eventTarget.addEventListener(eventName, (ev: Event) =>
			this.processEvent(eventName, prefix, ev)
		);
	}

	private processEvent(eventName: DomEventName, prefix: string, ev: Event) {
		if (!this.shouldProcessEvent(eventName)) return;

		const target = PAGE_LEVEL_EVENTS.has(eventName)
			? document.body
			: ev.target instanceof Element
				? ev.target
				: null;
		if (!target) return;

		const elements = collectTriggerElements(target, prefix);
		if (elements.length === 0) return;

		this.executeTriggers(elements, eventName, prefix, ev);
	}

	private shouldProcessEvent(eventName: DomEventName): boolean {
		if (eventName === "pointerdown") this.isTrackingPointer = true;
		if (eventName === "pointerup" || eventName === "pointercancel")
			this.isTrackingPointer = false;
		return eventName !== "pointermove" || this.isTrackingPointer;
	}

	private executeTriggers(
		elements: Element[],
		eventName: DomEventName,
		prefix: string,
		ev: Event
	) {
		let prevented = false;

		for (const el of elements) {
			if (!prevented) {
				const attrPreventDefault = el.getAttribute(
					`data-${eventName}-${EVENT_PARAM_PREVENT_DEFAULT}`
				);
				const shouldPreventDefault =
					attrPreventDefault !== null &&
					attrPreventDefault !== "false";
				if (shouldPreventDefault) {
					ev.preventDefault();
					prevented = true;
				}
			}

			const attrStopPropagation = el.getAttribute(
				`data-${eventName}-${EVENT_PARAM_STOP_PROPAGATION}`
			);
			const shouldStopPropagation =
				attrStopPropagation !== null && attrStopPropagation !== "false";

			const names = getTriggerNames(el, prefix);
			for (const name of names) void this.invoke(name, el, ev);

			if (shouldStopPropagation) {
				ev.stopImmediatePropagation();
				break;
			}
		}
	}
}
