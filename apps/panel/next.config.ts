import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// A single self-contained server bundle: the panel ships as one Node
	// process behind Hestia's nginx on :8083 (see the conversion plan).
	output: "standalone",
	// @hestiacp/lib ships TypeScript source inside the workspace.
	transpilePackages: ["@hestiacp/lib"],
};

export default nextConfig;
