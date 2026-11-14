import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages serves this project from a repository subpath; Vercel serves it from the domain root.
  base: process.env.GITHUB_ACTIONS === 'true' ? '/Halas-Clothing/' : '/',
  plugins: [react()],
})
