import { afterEach, beforeEach, vi } from "vitest";

export let trigger: typeof import("../src/index").default;

beforeEach(async () => {
	// 公開APIに監視停止がないため、登録を記録してテスト終了時に解除する。
	const documentListeners = vi.spyOn(document, "addEventListener");
	const windowListeners = vi.spyOn(window, "addEventListener");
	cleanupListeners = () => {
		for (const [type, listener, options] of documentListeners.mock.calls)
			document.removeEventListener(type, listener, options);
		for (const [type, listener, options] of windowListeners.mock.calls)
			window.removeEventListener(type, listener, options);
	};
	// ハンドラー・データキャッシュ・監視状態をテスト間で共有しない。
	vi.resetModules();
	trigger = (await import("../src/index")).default;
});

let cleanupListeners: () => void;

afterEach(() => {
	cleanupListeners();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	document.body.replaceChildren();
	for (const name of document.body.getAttributeNames())
		document.body.removeAttribute(name);
});
