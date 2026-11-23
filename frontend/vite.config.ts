import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    // during development, send /api calls to the FastAPI server
    proxy: { '/api': 'http://localhost:8000' }
  }
});
