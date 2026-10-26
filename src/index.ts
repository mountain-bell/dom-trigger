import {
	DomTriggerData,
	DomTriggerHandler,
	DomTriggerRunOptions,
	DomTriggerSetupOptions,
} from "./types";
import { isKebabName, UNCACHE_PARAM, collectData } from "./utils";
import { Registry } from "./registry";
import { EventListener, RESERVED_EVENT_TRIGGER_NAMES } from "./events";
import { ViewObserver, RESERVED_VIEW_TRIGGER_NAMES } from "./view";

const RESERVED_TRIGGER_NAMES = [
	...RESERVED_EVENT_TRIGGER_NAMES,
	...RESERVED_VIEW_TRIGGER_NAMES,
	UNCACHE_PARAM,
];

function use<TData extends DomTriggerData = DomTriggerData>(
	name: string,
	handler: DomTriggerHandler<TData>
) {
	if (!isKebabName(name)) {
		throw new Error(
			`[DomTrigger.use] Invalid trigger name: "${name}". Use kebab-case.`
		);
	}
	if (
		RESERVED_TRIGGER_NAMES.some(
			(reserved) => name === reserved || name.startsWith(`${reserved}-`)
		)
	) {
		throw new Error(`[DomTrigger.use] Reserved trigger name: "${name}".`);
	}
	Registry.set(name, handler as DomTriggerHandler);
}

async function run<TData extends DomTriggerData = DomTriggerData>(
	name: string,
	options?: DomTriggerRunOptions<TData>
) {
	if (!isKebabName(name)) {
		throw new Error(
			`[DomTrigger.run] Invalid trigger name: "${name}". Use kebab-case.`
		);
	}
	const handler = Registry.get(name);
	if (!handler) return;
	const el = options?.el;
	const data = options?.data;
	const event = options?.event;
	await handler({
		el,
		data,
		ctx: { name, source: "run", event },
	});
}

async function invoke(name: string, el: Element, event?: Event) {
	if (!isKebabName(name)) {
		throw new Error(
			`[DomTrigger.invoke] Invalid trigger name: "${name}". Use kebab-case.`
		);
	}
	const handler = Registry.get(name);
	if (!handler) return;
	const data = collectData(el, name);
	await handler({ el, data, ctx: { name, source: "invoke", event } });
}

function unuse(name: string) {
	if (!isKebabName(name)) {
		throw new Error(
			`[DomTrigger.unuse] Invalid trigger name: "${name}". Use kebab-case.`
		);
	}
	Registry.delete(name);
}

function clear() {
	Registry.clear();
}

const eventListener = new EventListener(invoke);
const viewObserver = new ViewObserver(invoke);

function listen() {
	eventListener.listen();
}

function observeView() {
	viewObserver.observe();
}

function setup() {
	listen();
	observeView();
}

function setupOnReady(options?: DomTriggerSetupOptions) {
	const { before, after, onError } = options ?? {};
	const initialize = () => {
		try {
			before?.();
			setup();
			after?.();
		} catch (error) {
			if (!onError) throw error;
			onError(error);
		}
	};

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initialize, {
			once: true,
		});
		return;
	}

	initialize();
}

const DomTrigger = {
	use,
	run,
	invoke,
	listen,
	observeView,
	unuse,
	clear,
	setup,
	setupOnReady,
} as const;

export {
	use,
	run,
	invoke,
	listen,
	observeView,
	unuse,
	clear,
	setup,
	setupOnReady,
};

export default DomTrigger;
