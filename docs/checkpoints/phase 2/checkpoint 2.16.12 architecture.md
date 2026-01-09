```path/to/raw_output/docs/checkpoints/phase 2/checkpoint 2.16.12 architecture.md#L1-43
# Checkpoint 2.16.12: Slider Notch Animation & State Fix

## Status
In Progress

## Problem Description
The settings volume slider, which features a "left notch" for the 0% value, exhibits two primary issues:
1.  **Animation Direction**: During large value jumps, dots animate in the wrong direction (e.g., disappearing left-to-right when moving to the 0% notch).
2.  **External Notch State**: External notches (like the one on the Volume slider) should only be lit when active (0%). When a value > 0% is selected, the notch should remain dim, even if it is to the left of the selection.

## Proposed Changes

### 1. Unified Logical Indexing
Refactor `SettingsUiFactory.ts` to use a consistent coordinate system for both internal and external notches.
- **`_resolveVisualContext`**: A new helper to determine if we are operating on a standard track or a container with an external notch. 
- In notched sliders, the notch is assigned index `0`, and the dots in the track are shifted to indices `1...N`.

### 2. Animation Wave Correction
- **`_calculateWaveDistance`**: Refine the distance calculation to use the previous selection's logical index as the origin for the animation wave. This ensures that moving to the notch triggers a "collapse" toward the left, and moving from the notch triggers an "expand" toward the right.

### 3. External Notch State Management
- **`_applyLeftAlignedState`**: Update the state logic to distinguish between dots and notches.
- For `left-aligned` tracks, items at `index < selectedIndex` typically "glow". This will be restricted to dots only.
- External notches will only receive the `active` state (when `index === selectedIndex`) and will remain `dull` otherwise, preventing the notch from staying lit while dots are selected.

## Deliverables
- [x] Refactor `updateTrackVisuals` to support logical indexing across external notches.
- [x] Implement conditional "glow" logic to keep deactivated notches dim.
- [x] Fix dot animation direction for left-notched sliders.

## Verification Plan
- Open settings and click the Master Volume notch (0%). Verify it is lit and dots disappear right-to-left.
- Click a dot (e.g., 50%). Verify the dot is lit/active, but the **notch is now dim**.
- Verify that dots to the left of the 50% selection are still lit (glow).
- Interact with "Dot Opacity" (no notch) and verify standard behavior is unchanged.
