```raw_output\docs\checkpoints\phase 2\checkpoint 2.16.5 architecture.md#L1-28
# Checkpoint 2.16.5 Architecture: Dot Cloud Layout Synchronization

## Overview
This document describes the architectural alignment between the CSS-driven layout of the `dot-cloud-container` and the programmatic rendering logic of the `DotCloudComponent` canvas. The goal is to ensure that the visualization is never clipped and exactly fills its allocated space.

## Dimensional Synchronization

### 1. Base Constants Alignment
To prevent drift, the base dimensions used in CSS and TypeScript must be derived from the same logical constants.

- **Base Width**: 14rem (expressed as 224px at 16px root font).
- **Base Height**: 2.2rem (expressed as 35.2px at 16px root font).

### 2. Scaling Logic Parity
The `ScalingService.ts` and the `index.html` CSS must use identical mathematical models for scaling:

- **CSS Implementation**: Uses `calc()` with `--master-scale` and `--dot-cloud-width-multiplier`.
- **TypeScript Implementation**: Uses `ScalingService.getScaledValue()` which multiplies the master factor by the specific factor.

### 3. Container-to-Canvas Mapping
The `DotCloudComponent` will be updated to:
- Use `rootFontSize` to convert `rem`-based CSS dimensions into pixel values for the canvas.
- Dynamically calculate `_canvasWidth` and `_canvasHeight` based on the exact same multipliers applied to the root style.
- Apply `overflow: visible` or ensure padding is sufficient if any jitter algorithms require breathing room, though primary alignment will focus on bounding box parity.

## Implementation Plan
- Update `DotCloudComponent._initializeCanvasDimensions` to use `224` as the base width to match the `14rem` in CSS.
- Ensure the `ScalingService` logic for `dotCloudWidth` correctly reflects the `calc()` logic used in the stylesheet.
- Remove any hardcoded pixel discrepancies that lead to the container being smaller than the rendered content.
