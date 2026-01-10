# Checkpoint 2.16.12 Architecture: Header Layout & Scroll Precision

This checkpoint refines the primary application layout for symmetry and implements a high-precision coordinate system for custom scrollbars to ensure visual consistency across different display scales.

## 1. Header Symmetry & Navigation

The application header has been transitioned from a flex-based "space-between" layout to a strict grid-based layout to achieve perfect centering of the navigation elements.

- **Grid Layout**: The `.app-header` now uses `grid-template-columns: 1fr auto 1fr`. This guarantees that the `.nav-menu` is mathematically centered relative to the viewport, regardless of the width of the logo or status indicators.
- **"Not Soon" Interaction**: To signify the non-functional status of the "Not Soon" navigation item, its hover state was modified. It now receives the standard background highlight (consistent with active buttons) but maintains its dimmed font color, visually communicating that while it is recognized by the UI, it is not an interactive target.

## 2. Dynamic Scrollbar Precision

The custom scrollbar implementation was upgraded to handle variable scaling and unit resolution.

- **REM-to-Pixel Synchronization**: Previously, the scroll track padding was hardcoded to `32px`. This caused the scroll thumb to overshoot or undershoot the visual track if the browser's base font size was not exactly `16px`. The `BenchmarkScrollController` now resolves the current pixel value of `1rem` at runtime via `getComputedStyle`.
- **Coordinate Mapping**: The available scroll range is now calculated using these resolved units: `trackPadding = 2 * resolvedRem`. This ensures the thumb's logical bounds always match the CSS `top: 1rem` and `bottom: 1rem` constraints.
- **Sub-pixel Accuracy**: The controller now uses `getBoundingClientRect()` instead of `offsetHeight` to retrieve the thumb's height, preventing cumulative rounding errors in the translation calculation.

## 3. Settings Menu Scrollbar Integration

The custom scrollbar logic has been extended to the Settings Menu, which previously used standard browser scrollbars.

- **Container-Card Architecture**: The settings menu was refactored into a `settings-menu-container` (holding the stationary glass background and the custom scroll track) and a `settings-menu-card` (the actual scrollable content).
- **Controller Reuse**: The `BenchmarkScrollController` was generalized to support instances where `AppStateService` is null. This allows the settings menu to benefit from the same "hover-to-scroll" and precision dragging logic without needing to persist its scroll position to the global state.
- **Visual Masking**: The stationary `::before` pseudo-element provides the same "cutout" shadow effect seen in the benchmark table, maintaining the application's unique tactile identity.

## 4. Technical Refinements

- **Z-Index Standardization**: Scrollbar masking elements (the track cutouts) have been moved to `z-index: -1` relative to their containers but kept within an isolated stacking context. This ensures content scrolls over them while they correctly mask the background dots.
- **Layout Consistency**: Padding and margins in the settings menu were adjusted to ensure the gutter for the custom thumb matches the width and spacing of the benchmark table gutter exactly.
