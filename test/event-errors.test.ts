import { execFileSync } from "node:child_process";
import { fileURLToPath, URL as NodeURL } from "node:url";
import { expect, it } from "vitest";

it("クリック経由の不正JSONはハンドラーと初期化用onErrorを呼ばず、未処理のPromise拒否になる", () => {
	// 未処理拒否の通知は、Vitest自身の監視と干渉しない別プロセスで確認する。
	const output = execFileSync(
		process.execPath,
		[
			"-e",
			String.raw`
const ts = require("typescript");
const fs = require("node:fs");
require.extensions[".ts"] = (module, filename) => {
	const result = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
		compilerOptions: { module: ts.ModuleKind.CommonJS },
	});
	module._compile(result.outputText, filename);
};
const { JSDOM } = require("jsdom");
const dom = new JSDOM('<button class="js-click-action" data-action="{broken}"></button>');
for (const key of ["window", "document", "Element"]) globalThis[key] = dom.window[key];
Object.defineProperty(document, "readyState", { value: "complete" });
globalThis.IntersectionObserver = undefined;
console.warn = () => {};
const trigger = require(process.argv[1]).default;
let handlerCalled = false;
let onErrorCalled = false;
const timeout = setTimeout(() => { process.exitCode = 1; dom.window.close(); }, 3000);
process.once("unhandledRejection", (error) => {
	clearTimeout(timeout);
	console.log(JSON.stringify({ message: error.message, handlerCalled, onErrorCalled }));
	dom.window.close();
});
trigger.use("action", () => { handlerCalled = true; });
trigger.setupOnReady({ onError: () => { onErrorCalled = true; } });
document.querySelector("button").click();
`,
			fileURLToPath(new NodeURL("../src/index.ts", import.meta.url)),
		],
		{ encoding: "utf8", timeout: 10000 }
	);
	expect(JSON.parse(output)).toEqual({
		message: "[DomTrigger] Invalid JSON in data-action: {broken}",
		handlerCalled: false,
		onErrorCalled: false,
	});
});
