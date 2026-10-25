import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

/**
 * GTM container resolution — the index.html side of the ONE rule that
 * src/site/analytics.ts (getGtmId) implements for the bundle: trim the
 * configured VITE_GTM_ID; a value that is absent, empty, whitespace-only,
 * or not a GTM- container id counts as UNSET and falls back to the
 * production container. An explicitly empty VITE_GTM_ID (build env or an
 * overriding env file) must never reach the HTML — Vite's %ENV%
 * substitution would otherwise emit a broken `gtm.js?id=` loader while
 * initAnalytics() skips its fallback injection (Codex P2 on PR #7).
 */
const PRODUCTION_GTM_ID = "GTM-T5HS9CSJ";

function resolveGtmId(raw: unknown): string {
  const v = typeof raw === "string" ? raw.trim() : "";
  return v.startsWith("GTM-") ? v : PRODUCTION_GTM_ID;
}

/** Substitute the resolved container ID into index.html, whatever state
 *  Vite's own %VITE_GTM_ID% replacement leaves behind. */
function gtmIdHtmlPlugin(gtmId: string): Plugin {
  return {
    name: "leander-gtm-id",
    transformIndexHtml(html) {
      let out = html.split("%VITE_GTM_ID%").join(gtmId);
      // If Vite's substitution ran first with an empty/blank/padded/junk
      // value, normalize the two places the ID lands in index.html: the
      // noscript iframe URL and the snippet's container argument.
      out = out.replace(
        /(googletagmanager\.com\/ns\.html\?id=)([^"]*)/g,
        (_m, p1: string, v: string) => p1 + resolveGtmId(v),
      );
      out = out.replace(
        /("dataLayer",\s*")([^"]*)(")/g,
        (_m, p1: string, v: string, p3: string) => p1 + resolveGtmId(v) + p3,
      );
      return out;
    },
  };
}

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "VITE_");
  // Shell environment wins over env files (Vite's own priority).
  const gtmId = resolveGtmId(process.env.VITE_GTM_ID ?? fileEnv.VITE_GTM_ID);
  return {
    plugins: [react(), tailwindcss(), gtmIdHtmlPlugin(gtmId)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
