// Firestore security rules tests — need the Firestore emulator (Java).
// Run with:  npm run test:rules:emulator   (CI does this automatically)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests-rules/**/*.test.js'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
