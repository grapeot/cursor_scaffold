import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: []
  },
  server: {
    host: '0.0.0.0', // 允许网络访问
    port: 5173,
    strictPort: false // 如果端口被占用，尝试下一个可用端口
  }
})
