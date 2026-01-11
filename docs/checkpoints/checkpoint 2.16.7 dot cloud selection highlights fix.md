# Checkpoint 2.16.7 Architecture: Dot Cloud Selection Highlights Fix

## Status
Completed

## Problem Statement
The Dot Cloud visualization currently has two visual synchronization issues when a benchmark row is selected:
1.  **Broken Metadata Colors**: Rank labels and notches default to black (or an incorrect state) instead of transitioning to the intended `--upper-band-3` color.
2.  **Initial Dot State**: Performance dots incorrectly start with the "upper band" (lighter) palette even when the row is not selected, instead of the "lower band" (darker) palette.

## Technical Analysis
The CSS in `index.html` defines semantic tokens for the Dot Cloud that change based on the `.selected` class of the parent `.scenario-row`:

```css
.scenario-row.selected {
    --vis-label-color: var(--upper-band-1);
    --vis-dot-rgb: var(--upper-band-2-rgb);
    --vis-latest-rgb: var(--upper-band-3-rgb);
}
```

The `DotCloudCanvasRenderer` reads these variables via `getComputedStyle(this._context.canvas)`. The issues stem from:
-   **Execution Timing**: If `getComputedStyle` is called before the CSS variables are fully resolved or while the canvas is detached, it may return empty/black.
-   **Static Mappings**: The root `:root` definitions for `--vis-dot-rgb` and `--vis-latest-rgb` are currently pointing to `upper-band` variables by default in some parts of the CSS, causing the "unselected" state to look like the "selected" state.

## Proposed Changes

### 1. `index.html` (CSS)
-   Correct the default (unselected) values of the visualization semantic tokens in `:root` to use the `lower-band` palette.
-   Ensure `--vis-highlight-rgb` (used for session highlights) is also appropriately themed for both states.

### 2. `DotCloudCanvasRenderer.ts`
-   Refine the color retrieval logic to handle cases where CSS variables might be missing (providing better fallbacks that match the theme).
-   Ensure the `drawMetadata` and `drawPerformanceDots` methods correctly re-query the styles from the canvas element during every render pass to pick up the changes triggered by the `.selected` class on the parent row.

## Verification Plan
1.  **Initial Load**: Verify all benchmark rows show dark blue/grey dots and labels (Lower Band).
2.  **Selection**: Select a row and verify that dots, notches, and text all transition to the light teal/white palette (Upper Band).
3.  **Deselection**: Select a different row and verify the previous row returns to the darker palette.
4.  **Session Highlight**: Verify that the latest play from the current session uses the highlight color (`--vis-highlight-rgb`) and that this color also responds to the selection state if defined.
