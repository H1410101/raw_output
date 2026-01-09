```raw_output\docs\checkpoints\phase 2\checkpoint 2.16.6 architecture.md#L1-43
# Checkpoint 2.16.6 Architecture: Exceeded Rank Visual Scaling

## Responsibility
Ensure that when a user's performance exceeds the highest defined rank threshold, the visualization no longer "snaps" to the next integer rank unit (which would create empty space). Instead, the horizontal scale should dynamically adjust so that the highest score is positioned near the right edge of the canvas, specifically at a distance of one dot radius from the boundary.

## Technical Components

### 1. `RankScaleMapper` Extension
- **New Method**: `getHighestRankIndex()`
- **Purpose**: Provides the integer index of the final rank threshold to the orchestration layer, allowing it to detect when a score has "broken" the scale.

### 2. `DotCloudComponent` Refinement
- **Logic**: Updated `_calculateDynamicBounds` to pass the `drawableWidth` into the bound calculation logic.
- **New Helper**: `_calculateExceededAlignedBounds(minRUScore, maxRUScore, width)`
  - Detects if `maxRUScore` > `highestRankIndex`.
  - Calculates an `edgeRatio` based on `1 - (dotRadius / width)`.
  - Determines a custom `maxRU` such that the `maxRUScore` maps to the `edgeRatio` position on the horizontal axis.
  - This ensures the dot's center is exactly one `dotRadius` away from the right edge, preventing clipping while maximizing use of space.

## Data Flow
1. `DotCloudComponent` calculates the Rank Unit (RU) values for all scores.
2. It identifies the maximum RU score.
3. If the maximum RU exceeds the highest threshold index (e.g., 7.5 RU when Rank 7 is the cap):
   - It bypasses standard `Math.ceil` snapping.
   - It calculates a floating-point `maxRU` boundary for the `RankScaleMapper`.
4. `RankScaleMapper.getHorizontalPosition` uses this custom `maxRU` to map the score to the exact pixel coordinate required.

## Constraints
- Only applies when `scalingMode` is "Aligned".
- Only triggers when the highest rank threshold is surpassed.
- Maintains the dot radius buffer to ensure visual quality.
