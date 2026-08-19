const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const watch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const extensionConfig = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "out/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: true,
  minify: false,
};

/** @type {import('esbuild').BuildOptions} */
const webviewConfig = {
  entryPoints: ["webview/main.ts"],
  bundle: true,
  outfile: "out/webview.js",
  format: "esm",
  platform: "browser",
  target: "es2022",
  sourcemap: false,
  minify: false,
};

async function build() {
  const tasks = [
    watch
      ? esbuild.context(extensionConfig).then((ctx) => ctx.watch())
      : esbuild.build(extensionConfig),
    watch
      ? esbuild.context(webviewConfig).then((ctx) => ctx.watch())
      : esbuild.build(webviewConfig),
  ];

  await Promise.all(tasks);

  const workerSrc = path.join(
    "node_modules",
    "pdfjs-dist",
    "build",
    "pdf.worker.min.mjs"
  );
  const workerOut = path.join("out", "pdf.worker.min.mjs");
  fs.copyFileSync(workerSrc, workerOut);

  console.log(`[${watch ? "watch" : "build"}] All bundles built (worker copied)`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
