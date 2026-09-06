import { build } from "esbuild";
import { readFileSync, writeFileSync, cpSync } from "node:fs";
import {prepareLibrary} from './prepare-library-assets.mjs';
prepareLibrary();
await build({ entryPoints: ["worker/projects.js"], outfile: "dist/server/index.js", bundle: true, format: "esm", platform: "browser", target: "es2022",
  plugins:[{name:'release-library-manifest',setup(b){b.onLoad({filter:/[/\\]library-manifest\.js$/},()=>({contents:'export default '+readFileSync('.generated/library-manifest.json','utf8'),loader:'js'}));}}] });
// Preserve the original static handoff files; extend only the generated deployment.
const manifest = JSON.parse(readFileSync(".openai/hosting.json", "utf8"));
writeFileSync("dist/.openai/hosting.json", JSON.stringify({ ...manifest, d1: "DB", r2: "LIBRARY" }, null, 2));
cpSync("drizzle", "dist/.openai/drizzle", { recursive: true });
