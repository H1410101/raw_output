import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    globals: true,
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        {
          browser: 'chromium',
          headless: true,
          context: {
            viewport: { width: 1920, height: 2400 },
          }
        },
      ],
    },
    setupFiles: ['./src/test/setup.ts'],
  },
});
