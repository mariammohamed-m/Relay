import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { relayCompile } from './vite-plugins/relay-compile';

export default defineConfig({
  plugins: [react(), relayCompile()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
