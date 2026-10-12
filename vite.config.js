import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.GITHUB_PAGES ? './' : '/',
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3001' } }
});
