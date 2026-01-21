---
trigger: always_on
---

ONLY THE USER IS ALLOWED TO DETERMINE WHEN THE CHECKPOINT IS DONE. However, you may check with the user if you detect discrepencies.

Scripts from `package.json`:
```
"scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "release": "standard-version",
    "prepare": "husky",
    "dev:edge": "wrangler pages dev --proxy 5173",
    "dev:full": "npm run build && wrangler pages dev",
    "lint": "eslint . && npm run lint:colors && npm run lint:scaling",
    "lint:fix": "eslint . --fix",
    "lint:colors": "node scripts/verify_palette_usage.js",
    "lint:scaling": "node scripts/verify_scaling.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```