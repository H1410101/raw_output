```raw_output\docs\checkpoints\phase 2\checkpoint 2.13 architecture.md#L1-43
# Checkpoint 2.13 Architecture: Visual Identity

## Overview
This checkpoint replaces standard UI controls with custom, Kovaaks-themed components. The design centers on the "Circle" and "Pill" motifs, common to aim-training targets.

## Architectural Changes

### 1. Custom UI Components
Standard HTML inputs are replaced with custom SVG-based or CSS-styled elements within the `BenchmarkView`.

#### The Notch Slider (9-Dot Slider)
- **Visuals**: A horizontal series of 9 dots.
- **State Representation**:
  - A vertical "notch" on the far left.
  - The selected value is rendered as a **Vertical Pill**.
  - Dots to the left of the selection are **Active**.
  - Dots to the right of the selection are **Dull**.
- **Logic**: Maps a 0-100 or 1-120 range into 9 discrete buckets for visualization, while preserving the underlying numerical value for settings.

#### The Multi-Select Slider
- **Visuals**: A smaller series of dots (matching the number of options) with no left notch.
- **Usage**: Replaces Segmented Controls for "Dot Size" and "Row Height".
- **State Representation**: Follows the same Vertical Pill logic as the Notch Slider.

#### The Circle Checkbox
- **Visuals**: A circular target.
- **State Representation**: 
  - Checked: A filled or thick-bordered circle (reminiscent of a Kovaaks target).
  - Unchecked: A hollow, thin-bordered circle.

### 2. Styling System
- **Layout Stability**: Setting rows use fixed heights and centered alignments to prevent vertical "bobbing" when circles transform into vertical pills.
- **Glow Removal**: All glow and `box-shadow` effects are removed globally to favor a flat, high-contrast, tactical aesthetic.
- **Layout Refinement**: Standardizes spacing between setting groups and items to move away from the generic "glassmorphism" look.

## Implementation Details
- `_createSettingSlider`: Refactored to render the 9-dot notch UI.
- `_createSettingToggle`: Refactored to render the circle checkbox UI.
- `_createSettingSegmentedControl`: Refactored to use the dot-based multi-select UI.

## Verifiable Outcome
- The Visual Settings menu no longer contains standard browser sliders or checkboxes.
- All sliders show the 9-dot pattern with a vertical pill and active trail.
- The menu remains layout-stable (no bobbing) and centered.
- Checkboxes appear as circles with no glow.
- Multi-select options appear as a series of dots without the notch.
