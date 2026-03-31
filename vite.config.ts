import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  build: {
    target: 'es2022', // Necesario para soportar la sintaxis moderna de pdfjs-dist
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },
})