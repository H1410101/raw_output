```raw_output\docs\checkpoints\phase 2\checkpoint 2.8.1 architecture.md#L1-43
# Checkpoint 2.8.1: Dot Cloud Vertical Alignment Refinement

## Objective
Refine the vertical positioning of performance dots in the `DotCloudComponent` to ensure they are centered within the visual space occupied by the rank notches, rather than being centered relative to the entire canvas (which includes space for rank labels).

## 1. Vertical Space Allocation
The current canvas height (`_canvasHeight`) is shared between the vertical notches and the rank labels. Rank labels are drawn at the bottom of the canvas, which causes the vertical center of the dots to appear lower than the center of the notches.

### Planned Adjustment
- Define a dedicated "notch height" or "drawing zone" for the dots and notches.
- Calculate the vertical center of this drawing zone by subtracting the space reserved for labels.
- Adjust `_drawPerformanceDots` to use this refined center.

## 2. Component Refactoring
The following changes will be applied to `DotCloudComponent.ts`:

### Geometry Constants
- Introduce a calculation for `labelSpace` based on the `root_font_size` and `textBaseline` settings.
- Explicitly define the `notchBottom` which determines the vertical extent of the notches.

### Dot Positioning
- Update the `finalY` calculation in `_drawPerformanceDots`:
  - Current: `this._canvasHeight / 2 - verticalOffset + jitterY`
  - New: `notchCenter + jitterY`, where `notchCenter` is half of the notch's vertical span.

### Notch Rendering
- Ensure `_drawVerticalNotch` uses the same `notchBottom` as the dot centering logic to maintain consistency.

## Verification Plan
1. **Alignment Check**: Visually verify that the dots are perfectly centered vertically against the white rank notches.
2. **Density Handling**: Ensure that vertical jitter still respects the bounds of the notch height and does not bleed into the label space.
3. **Scaling Check**: Verify that the alignment remains correct when fluid typography changes the `root_font_size`.
