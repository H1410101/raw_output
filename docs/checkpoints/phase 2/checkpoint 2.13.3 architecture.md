```raw_output\docs\checkpoints\phase 2\checkpoint 2.13.3 architecture.md#L1-20
# Checkpoint 2.13.3 Architecture: Colour & Transparency Tuning

## Context
Following the implementation of the core visual identity, the UI required a calibration pass to ensure consistent hierarchy and environmental integration. This pass focuses on the "lower band" typography, the dot cloud visualization, and the primary container opacities.

## Design Decisions
1. **Dot Cloud Palette**: 
    - Moved historical performance data to `lower-band-1` (#3D527A) to prevent it from competing with active UI elements.
    - Set rank notches to `lower-band-2` (#496C93) to provide structural guidance without visual clutter.
    - Implemented manual CSS variable resolution in `DotCloudComponent.ts` as the Canvas API cannot natively parse `var()` or `rgba(var(...))` syntax.

2. **Environmental Integration**:
    - Transitioned the benchmark table's large-scale "cut-out" shadow from the absolute black of `background-1` to the tinted `background-2` (#130F1A).
    - Calibrated primary containers (Benchmark Table, Settings Menu, Stats Folder Popout) to high-transparency `background-2` configurations (ranging from 20% to 24% opacity).
    - These adjustments, combined with existing backdrop blurs, allow the dynamic background grid and ripples to bleed through while maintaining content legibility.

3. **Tactile & Typographic Refinement**:
    - Updated the custom scroll thumb's inset shadows to use `background-2` to match the new panel depth.
    - Migrated the Stats Folder Popout typography to the "lower band" hierarchy, using `lower-band-1` for labels and `lower-band-2` for interactive/dynamic text to ensure a cohesive secondary-information aesthetic.

## Implementation Details
- **DotCloudComponent.ts**: Added `getComputedStyle` logic to resolve `--lower-band-1`, `--lower-band-2`, and `--highlight-font-1` before drawing to Canvas.
- **index.html**: 
    - Updated `.benchmark-table-container::before` box-shadow to `rgba(var(--background-2-rgb), 0.2375)`.
    - Updated `.settings-menu-card` and `.status-dropdown` backgrounds to `rgba(var(--background-2-rgb), 0.2)`.
    - Replaced `highlight-font-2` with `lower-band-1` and `lower-band-2` for all text elements within the stats popout.
    - Synchronized `.custom-scroll-thumb` and dropdown shadows with the `background-2` palette.
