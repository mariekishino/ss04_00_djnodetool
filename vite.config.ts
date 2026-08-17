import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
    // Phase 14: the local server (server/index.js) holds the audio folder and
    // the saved project. Proxying keeps the browser on one origin, so no CORS
    // handling is needed on either side.
    proxy: {
      '/api': 'http://localhost:5200',
      '/audio': 'http://localhost:5200',
    },
  },
})

// notes: 
// allowedHosts: 'all'
// → 型エラー。NG。
// allowedHosts: true
// → Vite 8の型としてOK。exe.dev開発用なら許容。
// allowedHosts: ['具体的なexe.devのホスト名']
// → より安全。ただしホスト名が変わる環境では面倒。
// allowedHosts: true は「どのホストからのアクセスも許可する」という意味なので、
// Vite公式はセキュリティ上、明示的なホスト名リストの方を推奨しています。
// 開発用VM・exe.dev上で一時的に使うなら現実的にはOKですが、本番設定ではありません。
// 公式にも true はDNS rebinding攻撃のリスクがあるため、明示リスト推奨とあります。
