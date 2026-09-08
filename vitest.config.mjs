import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';

// Test discovery is independent of dev-server proxies and build configuration.
// Keep file isolation: several suites intentionally mock modules or use stores.
export default defineConfig({
  plugins:[react()],
  test:{include:['tests/**/*.test.{ts,tsx}'],maxWorkers:2,isolate:true},
});
