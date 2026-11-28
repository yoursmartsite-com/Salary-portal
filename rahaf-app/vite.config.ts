import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // This app is hosted under the repository Pages sub-path.
  base: '/Salary-portal/rahaf-app/',
  build: {
    outDir: process.env.APPDEPLOY_VITE_OUT_DIR || 'dist',
    sourcemap:
      process.env.APPDEPLOY_VITE_SOURCEMAP === 'hidden' ? 'hidden' : false,
    target: ['chrome87', 'edge88', 'firefox78', 'safari14'],
  },
});
