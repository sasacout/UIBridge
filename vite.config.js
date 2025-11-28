import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const projectRoot = path.resolve(__dirname);

export default defineConfig({
  root: path.join(projectRoot, 'preview'),

  publicDir: path.join(projectRoot, 'public'),

  build: {
    outDir: path.join(projectRoot, 'preview-dist'),
    assetsDir: 'assets',
    emptyOutDir: true,
  },

  server: {
    fs: {
      allow: [
        projectRoot,
        path.join(projectRoot, 'public'),
        path.join(projectRoot, 'preview'),
      ],
    },
  },

  plugins: [react()],
});
