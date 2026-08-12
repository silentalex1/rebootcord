import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../dist-web'),
    emptyOutDir: true,
    assetsDir: 'assets',
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/register': 'http://localhost:3000',
      '/login': 'http://localhost:3000',
      '/logout': 'http://localhost:3000',
      '/sdk': 'http://localhost:3000',
    },
  },
})
