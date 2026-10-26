import { hasTrigger, getTriggerNames } from "./utils";
import { JS_PREFIX } from "./events";

const VIEW_PREFIX_MAP = {
	viewin: `${JS_PREFIX}viewin-`,
	viewout: `${JS_PREFIX}viewout-`,
};
const VIEW_NAMES = Object.keys(VIEW_PREFIX_MAP);
const VIEW_PREFIXES = Object.values(VIEW_PREFIX_MAP);

const VIEW_PARAM_RATIO = "view-ratio";
export const RESERVED_VIEW_TRIGGER_NAMES = [...VIEW_NAMES, VIEW_PARAM_RATIO];
const VIEW_SELECTOR = VIEW_PREFIXES.map(
	(prefix) => `[class*="${prefix}"]`
).join(", ");

function getViewState(entry: IntersectionObserverEntry): "in" | "out" {
	const attrRatio = entry.target.getAttribute(`data-${VIEW_PARAM_RATIO}`);
	const rawRatio = attrRatio ? parseFloat(attrRatio) : 0;
	const thresholdRatio = rawRatio >= 0 && rawRatio <= 1 ? rawRatio : 0;
	const currentRatio = entry.intersectionRatio;
	const isViewIn = entry.isIntersecting && currentRatio >= thresholdRatio;

	return isViewIn ? "in" : "out";
}

export class ViewObserver {
	private observer: IntersectionObserver | null = null;
	private registrationTokens = new Map<Element, symbol>();
	private viewState = new WeakMap<Element, "in" | "out">();

	constructor(
		private readonly invoke: (
			name: string,
			el: Element,
			event?: Event
		) => Promise<void>
	) {}

	observe() {
		const observer = this.getObserver();
		if (!observer) return;

		if (this.removeObsoleteTargets(observer)) {
			this.drainPendingEntries(observer);
		}
		const elements = document.querySelectorAll(VIEW_SELECTOR);
		elements.forEach((el) => this.registerTarget(el, observer));
	}

	private getObserver(): IntersectionObserver | null {
		if (typeof IntersectionObserver === "undefined") {
			console.warn(
				"[DomTrigger.observeView] IntersectionObserver is unavailable. VIEW monitoring is skipped."
			);
			return null;
		}

		if (!this.observer) {
			this.observer = new IntersectionObserver(
				(entries) => this.processEntries(entries),
				{
					threshold: Array.from({ length: 11 }, (_, i) => i / 10),
				}
			);
		}

		return this.observer;
	}

	private removeObsoleteTargets(observer: IntersectionObserver): boolean {
		let removed = false;
		for (const el of this.registrationTokens.keys()) {
			if (
				document.documentElement.contains(el) &&
				hasTrigger(el, ...VIEW_PREFIXES)
			)
				continue;
			removed = true;
			observer.unobserve(el);
			this.registrationTokens.delete(el);
			this.viewState.delete(el);
		}

		return removed;
	}

	private drainPendingEntries(observer: IntersectionObserver) {
		// Drain old results before re-registration, preserving other targets' results.
		const pending = observer
			.takeRecords()
			.filter((entry) => this.registrationTokens.has(entry.target));
		if (pending.length > 0) {
			const registrationSnapshot = new Map(
				pending.map((entry) => [
					entry.target,
					this.registrationTokens.get(entry.target),
				])
			);
			queueMicrotask(() =>
				this.processEntries(pending, registrationSnapshot)
			);
		}
	}

	private registerTarget(el: Element, observer: IntersectionObserver) {
		if (this.registrationTokens.has(el)) return;
		if (!hasTrigger(el, ...VIEW_PREFIXES)) return;
		observer.observe(el);
		this.registrationTokens.set(el, Symbol());
	}

	private processEntries(
		entries: IntersectionObserverEntry[],
		registrationSnapshot = new Map(
			entries.map((entry) => [
				entry.target,
				this.registrationTokens.get(entry.target),
			])
		)
	) {
		for (const entry of entries) {
			if (!(entry.target instanceof Element)) continue;
			const el = entry.target;
			const registrationToken = registrationSnapshot.get(el);
			if (
				!registrationToken ||
				this.registrationTokens.get(el) !== registrationToken
			)
				continue;

			const state = getViewState(entry);
			const previousState = this.viewState.get(el);
			if (state === "in" && previousState === "in") continue;
			if (state === "out" && previousState !== "in") continue;

			this.executeTriggers(el, state, registrationToken);
		}
	}

	private executeTriggers(
		el: Element,
		state: "in" | "out",
		registrationToken: symbol
	) {
		const prefix = VIEW_PREFIX_MAP[state === "in" ? "viewin" : "viewout"];
		const names = getTriggerNames(el, prefix);
		this.viewState.set(el, state);
		for (const name of names) {
			if (this.registrationTokens.get(el) !== registrationToken) break;
			void this.invoke(name, el);
		}
	}
}
