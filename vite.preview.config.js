import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist-preview', emptyOutDir: true, target: 'es2020', cssCodeSplit: false,
    rollupOptions: { input: 'preview.html', output: { format: 'iife', inlineDynamicImports: true, entryFileNames: 'preview.js', assetFileNames: 'preview.[ext]' } },
  },
});
