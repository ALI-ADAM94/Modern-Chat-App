import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The Express + Socket.IO backend (npm run dev in the project root)
const BACKEND = 'http://localhost:3000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // In development, forward API, uploads and websocket traffic to the backend
    proxy: {
      '/api': BACKEND,
      '/uploads': BACKEND,
      '/socket.io': { target: BACKEND, ws: true },
    },
  },
})
