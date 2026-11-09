import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/gateway': { target: 'ws://localhost:3000', ws: true },
      '/files': {
        target: 'http://localhost:9000',
        rewrite: (path) => path.replace(/^\/files/, '/glacier-uploads'),
      },
    },
  },
})
