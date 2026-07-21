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
  `export default {\n  async fetch(request, env) {\n    const response = await env.ASSETS.fetch(request);\n    if (response.status !== 404) return response;\n\n    const url = new URL(request.url);\n    if (!url.pathname.includes(".")) {\n      url.pathname = "/index.html";\n      return env.ASSETS.fetch(new Request(url, request));\n    }\n\n    return response;\n  },\n};\n`,
  "utf8",
);
