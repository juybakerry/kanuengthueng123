import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

/** สร้าง dist/sw.js พร้อมรายการไฟล์ที่ต้องแคชไว้ใช้ออฟไลน์ (หน้าแอป สคริปต์ ฟอนต์ไทย/ละติน รูปหลัก) */
function serviceWorker(): Plugin {
  return {
    name: 'kt-service-worker',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => {
        if (f.endsWith('.js') || f.endsWith('.css')) return true;
        if (f.endsWith('.woff2')) return /(thai|latin)-(?!ext)/.test(f) || /-thai-/.test(f);
        return false;
      });
      const extra = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/badge-96.png', '/icons/favicon-32.png', '/assets/logo-mark.png', '/assets/logo-full.jpg', '/assets/mood-mist.jpg', '/assets/mood-mountain-deck.jpg', '/assets/mood-campfire.jpg'];
      const list = [...extra, ...files.map((f) => `/${f}`)];
      const version = createHash('sha256').update(list.join('|') + Object.values(bundle).map((c) => ('code' in c ? c.code.length : 0)).join(',')).digest('hex').slice(0, 12);
      const src = readFileSync(new URL('./src/sw.js', import.meta.url), 'utf8').replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(list));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: src });
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  build: {
    assetsDir: 'static',
    target: ['es2020', 'safari15'],
    chunkSizeWarningLimit: 800,
  },
  server: {
    port: 5174,
    proxy: { '/api': 'http://127.0.0.1:8797' },
  },
});
