import { build } from "esbuild";
import { readFileSync, writeFileSync, cpSync } from "node:fs";
await build({ entryPoints: ["worker/projects.js"], outfile: "dist/server/index.js", bundle: true, format: "esm", platform: "browser", target: "es2022" });
// Preserve the original static handoff files; extend only the generated deployment.
const manifest = JSON.parse(readFileSync(".openai/hosting.json", "utf8"));
writeFileSync("dist/.openai/hosting.json", JSON.stringify({ ...manifest, d1: "DB" }, null, 2));
cpSync("drizzle", "dist/.openai/drizzle", { recursive: true });
