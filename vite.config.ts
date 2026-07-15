import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Honor an assigned port (parallel agent sessions each get their own
    // via PORT); default stays 5199 for humans.
    port: Number(process.env.PORT) || 5199,
    strictPort: true,
  },
})
