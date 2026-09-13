import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keeps Prisma out of Next's own server bundle. On Cloudflare this is what
  // lets OpenNext swap in Prisma's WebAssembly engine; without it the Worker
  // ships the Node client and fails looking for a native engine binary.
  // Next already treats Prisma this way on Node, so local runs are unchanged.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  // Next traces the files the server needs by simulating a Node run, and on
  // Node Prisma uses its native engine, so the WebAssembly build is never
  // traced. OpenNext only carries traced .wasm files into the Worker, so
  // without this the Worker ships no engine it can load. Force them in.
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/.prisma/client/wasm.js",
      "./node_modules/.prisma/client/wasm-worker-loader.mjs",
      "./node_modules/.prisma/client/wasm-edge-light-loader.mjs",
      "./node_modules/.prisma/client/query_engine_bg.js",
      "./node_modules/.prisma/client/query_engine_bg.wasm",
    ],
  },
  experimental: {
    serverActions: {
      // Site photos arrive as data URLs from the browser camera.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
