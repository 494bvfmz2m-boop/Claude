// Bundles src/car3d.js into one classic script and inlines the car model as
// base64, so index.html also works when opened straight from disk (file://),
// where ES modules and fetch() of local files are blocked by the browser.
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const model = readFileSync("src/car-model.glb").toString("base64");
writeFileSync("js/car-model.js", `window.CAR_MODEL_B64="${model}";\n`);

await build({
  entryPoints: ["src/car3d.js"],
  bundle: true,
  format: "iife",
  minify: true,
  target: ["es2019"],
  outfile: "js/car3d.js",
  legalComments: "none",
  logLevel: "info",
});

// Inloggen en online opslag van de beheerpagina (Firebase).
await build({
  entryPoints: ["src/admin-cloud.js"],
  bundle: true,
  format: "iife",
  minify: true,
  target: ["es2019"],
  outfile: "admin/firebase.js",
  legalComments: "none",
  logLevel: "info",
});
