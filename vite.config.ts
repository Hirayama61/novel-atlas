import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages のプロジェクトサイト (https://<user>.github.io/novel-atlas/) 用。
const base = process.env.VITE_BASE ?? "/novel-atlas/";

// 書き込み権限のあるトークンを端末に置くので、ビルド成果物では外部のスクリプトと通信先を GitHub API に絞る。
// 開発サーバーはインラインスクリプトを使うので、ビルド時だけ差し込む。
const CSP =
  "default-src 'self'; connect-src 'self' https://api.github.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'";

export default defineConfig({
  base,
  plugins: [
    react(),
    {
      name: "csp",
      apply: "build",
      transformIndexHtml: () => [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: CSP },
          injectTo: "head-prepend",
        },
      ],
    },
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Novel Atlas",
        short_name: "Novel",
        description: "自分用の小説アトラス",
        lang: "ja",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#f5f1e8",
        theme_color: "#3b3326",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        // GitHub API への問い合わせはキャッシュしない (トークン付きのため)
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  test: {
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
  },
});
