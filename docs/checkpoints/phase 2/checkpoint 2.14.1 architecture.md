# Checkpoint 2.14.1 Architecture: Background Dynamics

## High-Level Objective
The goal is to move beyond static backgrounds by implementing a dynamic "dot grid" system that reacts to the foreground UI elements and exhibits autonomous motion through multiple overlapping "opacity ripples".

## Component: Background Layer
A fixed-position background layer will be injected into the root `index.html`. 

### Dot Grid Implementation
- **Spacing**: 10rem (using fluid units to match the existing design philosophy).
- **Element**: A single full-screen `div` using a CSS `radial-gradient` as a background image to create the dots.
- **Color**: A subtle grey (`--text-dim` at low opacity).

### Ripple Animation
- **Mechanism**: Multiple overlapping layers (`.ripple`) using `mask-image` with sharp-edged radial gradients.
- **Visual**: High-contrast mask boundaries create "sharp" waves of dot visibility. Ripples are opacity-based (stacking on a base faint grid) rather than purely subtractive transparency.
- **Directionality**: Three distinct layers moving in random/oblique directions (`ripple-slow`, `ripple-oblique`, `ripple-sideways`) to create complex intersections.
- **Timing**: Extremely slow durations (90s - 140s) for a glacial, non-distracting flow.

## Interaction: Backdrop Blur & Global Softness
- **Global Blur**: The entire background dynamic layer uses a `filter: blur(0.05rem)` to soften the dot grid.
- **Backdrop**: The existing `.dashboard-panel` (benchmark card) includes `backdrop-filter: blur(...)` to further interact with the underlying moving grid.

## Technical Details
- **Performance**: Use `will-change: transform` or `will-change: mask-image` to ensure the animation is offloaded to the GPU.
- **Layering**: The background will sit at `z-index: -1` relative to the `#app` container.
- **Variables**: Transition and ripple values will be exposed via CSS variables for easy tuning.