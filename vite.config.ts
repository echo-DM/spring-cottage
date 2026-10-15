import { defineConfig } from 'vite';

export default defineConfig({
  base: '/spring-cottage/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
});
