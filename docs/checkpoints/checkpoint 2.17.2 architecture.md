# Checkpoint 2.17.2: Dual Theme Support Architecture

This checkpoint introduces a secondary "Light Mode" theme to the application, implementing a toggle mechanism and ensuring all visual components (including Canvas-based visualizations) respond to theme changes.

## 1. Palette Extension
The `palette.css` file is updated to include a `[data-theme="light"]` selector. This selector overrides the default dark theme variables with the new specification:

- **Backgrounds**: Transitions from deep blacks/purples to soft greys (`#F0F5F5`, `#DFECEB`).
- **Typography Bands**:
    - **Lower Band**: Transitions from muted blues to teal-adjacent tones (`#85C1BC`, `#6CB7B7`, `#53A8AC`).
    - **Upper Band**: Transitions from light teals to deep slate blues/blacks (`#2D5471`, `#223C59`, `#162541`).
- **Highlights**: Updated to a light slate tone (`#D2D4E0`).

## 2. Theme Management Logic
The `VisualSettings` interface is expanded to include a `theme` property.

### `VisualSettingsService.ts`
- Added `theme: "dark" | "light"` to the settings state.
- The `_applyCssVariables` method now updates the `data-theme` attribute on the `document.documentElement`, triggering CSS variable swaps.

### `BenchmarkView.ts`
- Implemented `toggleTheme()` which reads the current state from `VisualSettingsService`, flips it, and updates the service.

### `AppBootstrap.ts`
- Wired the `#header-theme-btn` click event to `this._benchmarkView.toggleTheme()`.

## 3. Reactive Visualizations
The `DotCloudCanvasRenderer` already uses `getComputedStyle` and semantic tokens (like `--vis-dot-rgb`) during its render pass. 

- **Selection Logic**: When a row is selected, it uses the "opposite" band. In dark mode, it switches to upper-band (lighter). In light mode, it switches to upper-band (darker). This ensures high contrast in both themes.
- **Background Dynamics**: The grid and ripples in `index.html` use `var(--lower-band-X)` and `var(--upper-band-X)`. Since these variables are now swapped via `data-theme`, the background automatically adapts its colors.

## 4. Verification Plan
- **Toggle Mechanism**: Clicking the moon/sun icon in the header should immediately swap all colors.
- **Persistence**: Refreshing the page should preserve the selected theme via `localStorage` (handled by `VisualSettingsService`).
- **Contrast**: Verify that text remains readable in both modes, specifically checking selected rows and rank badges.
- **Canvas Rendering**: Ensure dot clouds and labels update their colors correctly when the theme is toggled.
