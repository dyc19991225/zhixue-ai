import { build } from "esbuild";
import { mkdir, cp } from "node:fs/promises";
const out = "work/vps-deploy/standalone";
await mkdir(out, { recursive: true });
await build({
  stdin: {
    contents: 'import "./apps/api/src/server.ts";',
    resolveDir: process.cwd(),
    sourcefile: "vps-entry.ts",
  },
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  outfile: out + "/server.mjs",
  external: ["*.node", "pg-native"],
  banner: {
    js: 'import{createRequire as __createRequire}from"node:module";import{fileURLToPath as __fileURLToPath}from"node:url";import{dirname as __pathDirname}from"node:path";const require=__createRequire(import.meta.url);const __filename=__fileURLToPath(import.meta.url);const __dirname=__pathDirname(__filename);',
  },
  plugins: [
    {
      name: "linux-bcrypt-prebuild",
      setup(b) {
        b.onResolve({ filter: /^node-gyp-build$/ }, () => ({
          path: "bcrypt-native",
          namespace: "bcrypt-shim",
        }));
        b.onLoad({ filter: /.*/, namespace: "bcrypt-shim" }, () => ({
          contents:
            'module.exports = function(){return require("./bcrypt.glibc.node")};',
          loader: "js",
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
await cp(
  "node_modules/bcrypt/prebuilds/linux-x64/bcrypt.glibc.node",
  out + "/bcrypt.glibc.node",
);
console.log("Standalone API packaged with Linux bcrypt.");
