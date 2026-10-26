export type DomTriggerData = Record<string, unknown>;

export interface DomTriggerSetupOptions {
	before?: () => void;
	after?: () => void;
	onError?: (error: unknown) => void;
}

export interface DomTriggerContext {
	readonly name: string;
	readonly source: "run" | "invoke";
	readonly event?: Event;
}

export interface DomTriggerArgs<TData extends DomTriggerData = DomTriggerData> {
	readonly el?: Element;
	readonly data?: TData;
	readonly ctx: DomTriggerContext;
}

export type DomTriggerHandler<TData extends DomTriggerData = DomTriggerData> = (
	args: DomTriggerArgs<TData>
) => void | Promise<void>;

export interface DomTriggerRunOptions<
	TData extends DomTriggerData = DomTriggerData,
> {
	el?: Element;
	data?: TData;
	event?: Event;
}
