import { vi } from "vitest";

export function entry(
	target: Element,
	intersectionRatio: number,
	isIntersecting = intersectionRatio > 0
): IntersectionObserverEntry {
	return {
		target,
		intersectionRatio,
		isIntersecting,
		time: 0,
		boundingClientRect: new DOMRect(),
		intersectionRect: new DOMRect(),
		rootBounds: null,
	};
}

// レイアウト計算は行わず、ブラウザーから届く結果と保留中の結果を制御する。
export class TestIntersectionObserver implements IntersectionObserver {
	static instances: TestIntersectionObserver[] = [];
	readonly root = null;
	readonly rootMargin = "0px";
	readonly thresholds: readonly number[];
	readonly targets = new Set<Element>();
	readonly observed: Element[] = [];
	pending: IntersectionObserverEntry[] = [];

	constructor(
		private readonly callback: IntersectionObserverCallback,
		options?: IntersectionObserverInit
	) {
		const threshold = options?.threshold ?? 0;
		this.thresholds = Array.isArray(threshold) ? threshold : [threshold];
		TestIntersectionObserver.instances.push(this);
	}

	observe(target: Element) {
		this.targets.add(target);
		this.observed.push(target);
	}
	unobserve(target: Element) {
		this.targets.delete(target);
	}
	disconnect() {
		this.targets.clear();
	}
	takeRecords() {
		return this.pending.splice(0);
	}
	emit(...entries: IntersectionObserverEntry[]) {
		this.callback(entries, this);
	}
}

export function installIntersectionObserver() {
	TestIntersectionObserver.instances = [];
	vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
}

export function observer() {
	const instance = TestIntersectionObserver.instances[0];
	if (!instance) throw new Error("VIEW監視が開始されていない");
	return instance;
}
