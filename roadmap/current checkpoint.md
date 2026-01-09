# Current Checkpoint: 2.16.9: Centralized Colour Palette

## Status
Completed

## Deliverables
- [x] Create `src/styles/palette.css` to house all hex and RGB color literals.
- [x] Link `palette.css` in `index.html` and import it in `src/main.ts`.
- [x] Refactor `index.html` to use functional CSS variables instead of hardcoded hex values.
- [x] Update `scripts/verify_palette_usage.js` to enforce the new design by excluding `palette.css` from its checks while including all other `.css`, `.ts`, and `.js` files.
- [x] Verify that `npm run lint:colors` passes with zero violations across the codebase.