---
trigger: always_on
---

View `docs/current commit.md` to understand the immediate current progress. Maintain the current progress document with all tasks and architecture changes, which includes at every interaction with the user. Keep the previous progress unless your changes strictly override those.
If there is progress in the document and you are working on something new, assume you are working on the same commit.

On commit, note that lint and husky are configured.
After the commit, clear `docs/current commit.md`.

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