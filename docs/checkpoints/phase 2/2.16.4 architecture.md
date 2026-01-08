# Checkpoint 2.16.4 Architecture: Populated Density Scaling & Clamped Jitter

## Overview
This document outlines the mathematical and architectural refinements made to the performance dot cloud visualization, specifically focusing on the non-linear jitter expansion and collision-safe layout.

## Core Mechanics

### 1. Populated Density Scaling
To ensure the dot cloud feels "full" and intuitively appropriately spaced regardless of the number of dots, we use a population-weighted model.

#### The Jitter Equation:
The vertical spread of a dot is calculated as a random uniform sample in the interval:
$$\text{JitterOffset} \in [-\text{LocalMax}, \text{LocalMax}]$$

Where the **LocalMax** is defined by:
$$\text{LocalMax} = \text{GlobalMaxDotHeight} \times \text{JitterMultiplier} \times \left(\frac{\text{LocalDensity}}{\text{PeakDensity}}\right)^3 \times \left(0.25 + 0.75 \times \frac{\text{TotalDots}}{\text{Baseline}}\right)$$

#### Variables:
- **GlobalMaxDotHeight**: The maximum available vertical spread that prevents dots from clipping the canvas edges or overlapping labels ($\text{NotchHeight}/2 - \text{DotRadius}$).
- **JitterMultiplier**: A scaling factor derived from the "Dot Jitter" setting level (Min to Max).
- **LocalDensity / PeakDensity**: Normalizes the spread based on cluster intensity using a cubic ratio. 
- **Population Ratio ($0.25 + 0.75 \times \text{TotalDots}/\text{Baseline}$)**: Provides controlled expansion based on dataset size. Ensures a minimum spread (0.25) even with few dots, scaling up to a baseline of 100.

**Local Density** is calculated for dots of score $x$ in **Rank Unit (RU) space** with a window of $\pm0.5$:
$$\text{LocalDensity} = \sum_{y \in \text{window}} \left(\frac{|x - y|}{\text{windowSize}}\right)^3$$
This allows jitter to occur when dots are sparse, while still heavily favouring tight clusters of dots when dots are dense.

### 2. Collision-Safe Rendering
Aesthetics and readability are maintained by ensuring dots never bleed into secondary UI elements.

- **Radius-Aware Clamping**: The $\text{GlobalMaxDotHeight}$ explicitly subtracts the $\text{DotRadius}$. This guarantees that even at the absolute maximum jitter value, the outer edge of the dot remains 1 pixel away from the rank labels or the top of the visualization container.
- **Symmetrical Vertical Spread**: Jitter is calculated as a balanced deterministic offset from the center horizontal rank-line, ensuring a stable and professional look.

## Implementation Details

- **`DotCloudCanvasRenderer`**: Performs a pre-pass on every draw cycle to generate a density map and identify the global $\text{PeakDensity}$. 
- **Deterministic Pseudo-Randomness**: Uses a sine-based stable oscillator to ensure dots stay "locked" in place between frames unless the data or settings change.
