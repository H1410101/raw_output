```raw_output\docs\checkpoints\phase 2\checkpoint 2.14.2 architecture.md#L1-37
# Checkpoint 2.14.2 Architecture: Scroll Track Cut-out Refinement

This document outlines the implementation of the "glass cut-out" effect for the benchmark table's scroll track, ensuring visual consistency and depth in the UI.

## Visual Specification

The goal is to provide a stationary glass background for the benchmark table while creating a transparent "hole" where the scroll track resides. This avoids visual overlap between the glass tint and the scroll track's empty space.

### Glass Layer
- **Background**: `rgba(255, 255, 255, 0.01)`
- **Implementation**: Provided via a stationary `::before` pseudo-element on the `.benchmark-table-container`.
- **Behavior**: Remains fixed relative to the container, while rows scroll over it.

### Scroll Track "Cut-out"
- **Geometry**: 
  - Width: `0.375rem`
  - Top/Bottom Margin: `1rem`
  - Right Margin: `1rem`
  - Border Radius: `0.625rem` (matching the scroll thumb).
- **Technique**: An inverted mask created using a massive `box-shadow` (`spread: 2000px`) cast from a transparent element positioned exactly over the scroll track.
- **Rendering**: The shadow fills the container with the glass tint, while the source element (the "hole") remains transparent.

## Component Changes

### Style Definitions
- Removed `background` from `.benchmark-category-group` to allow the underlying stationary glass to show through.
- Configured `.benchmark-table-container::before` as the shadow-casting element.
- Set `z-index: -1` on the pseudo-element to ensure it remains behind the table content but above the background dot grid.
- Disabled interaction on the mask using `pointer-events: none`.

## COORDINATION

- **Container Isolation**: The `.benchmark-table-container` uses `isolation: isolate` and `overflow: hidden` to ensure the massive shadow is clipped correctly to the panel boundaries and does not bleed into the rest of the dashboard.
