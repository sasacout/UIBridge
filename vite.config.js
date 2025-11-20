import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  root: 'preview',
  build: { outDir: '../preview-dist' },
  plugins: [react()]
});