import fs from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const copyright = fs
	.readFileSync("LICENSE", "utf8")
	.match(/^Copyright[^\r\n]+/m)?.[0];
if (!copyright) throw Error("Copyright notice not found in LICENSE.");
const args = process.argv.slice(2);
const licenseUrl = args.includes("--format=iife")
	? ` | ${pkg.homepage.replace(/#.*$/, "")}/blob/main/LICENSE`
	: "";
const banner = `/*! ${pkg.name} v${pkg.version} | ${pkg.license} License | ${copyright}${licenseUrl} */`;
const result = spawnSync(
	process.execPath,
	[require.resolve("esbuild/bin/esbuild"), ...args, `--banner:js=${banner}`],
	{ stdio: "inherit" }
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
