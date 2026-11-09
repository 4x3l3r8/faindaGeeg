import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The client reads the API base URL from `import.meta.env.VITE_API_BASE_URL`
// (see src/lib/api.ts). Vite exposes any `VITE_`-prefixed variable from the
// root `.env` file automatically, so no extra wiring is required here.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
  },
  preview: {
    port: Number(process.env.WEB_PORT ?? 5173),
  },
});
