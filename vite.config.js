import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  build: {
    chunkSizeWarningLimit: 2600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@xyflow')) return 'vendor-flow';
          if (id.includes('node_modules/node-sql-parser')) return 'vendor-sql';
          if (id.includes('node_modules/react')) return 'vendor-react';
        },
      },
    },
  },
})
