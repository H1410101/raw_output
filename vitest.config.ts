import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

const enableBrowser = process.env.VITEST_BROWSER === '1';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    browser: {
      enabled: enableBrowser,
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
