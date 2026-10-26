import { DomTriggerHandler } from "./types";

const handlers = new Map<string, DomTriggerHandler>();

export const Registry = {
	set(name: string, handler: DomTriggerHandler) {
		handlers.set(name, handler);
	},
	get(name: string): DomTriggerHandler | undefined {
		return handlers.get(name);
	},
	delete(name: string) {
		handlers.delete(name);
	},
	clear() {
		handlers.clear();
	},
};
