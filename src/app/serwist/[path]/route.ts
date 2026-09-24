import { createSerwistRoute } from "@serwist/turbopack";

// Serves the compiled service worker at /serwist/sw.js. The revision versions precached pages
// per deployment; on Vercel the commit SHA is available at build time.
const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
});
