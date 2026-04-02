import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'cobertura', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/**/*.d.ts'],
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // VITE_PROXY_TARGET is set to http://backend:3001 in docker-compose.yml
        // so the Vite dev server inside the container can reach the backend service.
        // Falls back to localhost for non-Docker local dev.
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
