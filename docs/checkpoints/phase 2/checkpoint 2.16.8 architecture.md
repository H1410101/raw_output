# Checkpoint 2.16.8 Architecture: Centralized Colour Palette

## Objective
Decouple color definitions from the application structure and logic by establishing a single source of truth for the visual palette. This ensures consistency, simplifies theme updates, and prevents color repetition in the large `index.html` file.

## Proposed Changes

### 1. Palette Centralization
- Extract all hex and RGB color literals from `:root` in `index.html`.
- Create `src/styles/palette.css` to house these definitions.
- Organize variables into logical groups: Foundations, Typography Bands, Highlights, and Functional Mappings.

### 2. Style Integration
- Link `palette.css` in the `<head>` of `index.html` to ensure styles are available during initial paint.
- Import `palette.css` in `src/main.ts` to allow Vite to manage the asset and include it in the build pipeline.

### 3. Automated Enforcement
- Refactor `scripts/verify_palette_usage.js`:
    - Update `COLOR_LITERAL_REGEX` to catch all hex and rgb/rgba formats.
    - Expand file scanning to include `.css` files in addition to `.ts` and `.js`.
    - Implement an exclusion rule for `src/styles/palette.css`, allowing it to be the sole repository of raw color data.
    - Remove special-case logic for `index.html` variable declarations, forcing it to follow the same strict rules as the rest of the codebase.

## Constraints
- No color literals (hex, rgb, rgba) are permitted outside of `src/styles/palette.css`.
- All UI elements must reference functional tokens (e.g., `var(--text-main)`) or palette tokens (e.g., `var(--upper-band-1)`).
- The linting script must fail the build if a hardcoded color is detected in any source file.
