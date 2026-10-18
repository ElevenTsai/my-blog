// @ts-check
import { defineConfig } from 'astro/config';

const target = new URL(process.env.SITE_URL || 'https://eleventsai.github.io/my-blog/');
const base = process.env.SITE_BASE ?? target.pathname;

// https://astro.build/config
export default defineConfig({
  site: target.origin,
  base,
  outDir: process.env.BUILD_OUT_DIR || './dist',

  build: {
    // Preserve source structure:
    //   src/pages/index.astro         -> dist/index.html
    //   src/pages/highlight.astro     -> dist/highlight.html
    //   src/pages/posts/index.astro   -> dist/posts/index.html
    //   src/pages/posts/[slug].astro  -> dist/posts/<slug>.html
    format: 'preserve',
    inlineStylesheets: 'auto',
  },

  compressHTML: true,
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },

  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    },
  },

  // Static-only site — no SSR adapter needed
  output: 'static',

  // Vite config for finer control
  vite: {
    build: {
      // Keep asset filenames stable for CDN caching
      assetsDirName: 'assets',
    },
  },

  // Dev server
  server: {
    port: 4321,
    host: false,
  },
});
