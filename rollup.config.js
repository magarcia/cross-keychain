import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import dts from "rollup-plugin-dts";

const external = [
  "fs",
  "path",
  "os",
  "child_process",
  "crypto",
  "meow",
  // Mark @napi-rs/keyring as external - it's an optional dependency
  "@napi-rs/keyring",
];

export default [
  // Main library - ESM
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.js",
      format: "es",
      sourcemap: true,
    },
    external,
    plugins: [
      resolve({ preferBuiltins: true }),
      commonjs(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        declarationMap: false,
      }),
    ],
  },
  // Main library - CJS
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.cjs",
      format: "cjs",
      sourcemap: true,
      exports: "named",
    },
    external,
    plugins: [
      resolve({ preferBuiltins: true }),
      commonjs(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        declarationMap: false,
      }),
    ],
  },
  // CLI - ESM only
  {
    input: "src/cli.ts",
    output: {
      file: "dist/cli.js",
      format: "es",
      sourcemap: false,
      banner: "#!/usr/bin/env node",
    },
    external: [...external, "./index.js"],
    plugins: [
      resolve({ preferBuiltins: true }),
      commonjs(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        declarationMap: false,
      }),
    ],
  },
  // Type definitions - ESM
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.d.ts",
      format: "es",
    },
    external,
    plugins: [dts()],
  },
  // Type definitions - CJS
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.d.cts",
      format: "es",
    },
    external,
    plugins: [dts()],
  },
  // CLI type definitions
  {
    input: "src/cli.ts",
    output: {
      file: "dist/cli.d.ts",
      format: "es",
    },
    external: [...external, "./index.js"],
    plugins: [dts()],
  },
];
