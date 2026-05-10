import { resolve } from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: resolve(__dirname, ".."),
};

export default config;
