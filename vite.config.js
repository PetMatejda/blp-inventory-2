import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 800, // Firebase SDK alone is ~770 kB
    rollupOptions: {
      output: {
        // Libraries change less often than the app: separate files stay cached between releases.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(@firebase|firebase|re2js)\//.test(id)) return 'vendor-firebase';
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
          if (/node_modules\/lucide-react\//.test(id)) return 'vendor-icons';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{js,jsx}'],
    clearMocks: true,
  }
});
