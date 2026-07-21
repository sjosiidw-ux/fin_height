import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const output = resolve(root, "out");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "server"), { recursive: true });
await cp(output, dist, { recursive: true });

// Sites provisions the ASSETS binding for the static export. Keeping the
// runtime tiny makes the published twin load exactly like its local build.
await writeFile(
  resolve(dist, "server", "index.js"),
  `export default {\n  async fetch(request, env) {\n    return env.ASSETS.fetch(request);\n  },\n};\n`,
  "utf8",
);
