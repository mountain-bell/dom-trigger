export function isKebabName(name: string): boolean {
	return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name);
}

export function hasTrigger(el: Element, ...prefixes: string[]): boolean {
	const classes = el.classList;
	for (let i = 0; i < classes.length; i++) {
		const cls = classes[i];
		for (const prefix of prefixes) {
			if (cls.startsWith(prefix) && isKebabName(cls.slice(prefix.length)))
				return true;
		}
	}
	return false;
}

export function getTriggerNames(el: Element, prefix: string): string[] {
	const names: string[] = [];
	el.classList.forEach((cls) => {
		if (!cls.startsWith(prefix)) return;
		const name = cls.slice(prefix.length);
		if (isKebabName(name)) names.push(name);
	});
	return names;
}

const cache = new WeakMap<Element, Map<string, Record<string, unknown>>>();

export const UNCACHE_PARAM = "uncache";

export function collectData(
	el: Element,
	name: string
): Record<string, unknown> {
	const uncacheAttr = `data-${UNCACHE_PARAM}-${name}`;
	const shouldCache = !el.hasAttribute(uncacheAttr);

	if (shouldCache) {
		const inner = cache.get(el);
		const cached = inner?.get(name);
		if (cached) return cached;
	}

	const targetAttr = shouldCache ? `data-${name}` : uncacheAttr;
	const raw = el.getAttribute(targetAttr);
	if (!raw) return {};

	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error(`[DomTrigger] Invalid JSON in ${targetAttr}: ${raw}`);
	}

	if (shouldCache) {
		const inner = cache.get(el) ?? new Map();
		inner.set(name, parsed);
		cache.set(el, inner);
	}

	return parsed;
}
