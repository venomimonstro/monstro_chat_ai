import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // Built iframe is served at /iframe/index.html — assets must use /iframe/assets/*
  base: '/iframe/',
  plugins: [react()],
  resolve: {
    alias: {
      '@ai-consultant/shared-types': path.resolve(
        __dirname,
        '../../packages/shared-types/src/index.ts',
      ),
    },
  },
  server: { port: 5175, strictPort: true },
  preview: { port: 5175, host: true, strictPort: true },
  build: {
    outDir: 'dist/iframe',
    emptyOutDir: true,
    target: 'es2020',
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('socket.io-client')) return 'socket';
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor';
          }
        },
      },
    },
  },
});
