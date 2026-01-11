# Checkpoint 2.14 Architecture: Tactile Refinements & Grouping

## Overview
This checkpoint focuses on refining the tactical UI language introduced in the previous checkpoint. It introduces logical grouping for settings (specifically the Dot Cloud suite), improves layout compactness to match the benchmark data, and tunes the interaction model to be more "instant" and "utilitarian," mimicking the feel of high-performance aim trainers.

## Architectural Changes

### 1. Settings Grouping & Logic
- **Collapsible Groups**: Introduced `_createSettingsGroup` to allow nesting related settings.
- **Dependency Wiring**: The "Dot Cloud" group now acts as a master switch. When disabled, sub-settings (Opacity, Bounds, Size, Jitter) are visually hidden and retracted.
- **Overflow Management**: Sub-row containers support a maximum of 4 rows (8.5rem) before introducing a localized scrollbar, maintaining menu stability.

### 2. Interaction Model Refinement
- **Animation Removal**: Removed CSS transitions for clicking dots/pills within tracks. In aim trainers like Kovaaks, targets spawn instantly; the UI now reflects this "instant feedback" philosophy.
- **Conditional Notches**: Notches are now context-aware. They only appear on sliders where a "Zero" or "Minimum" state is mathematically distinct and desirable (e.g., Master Volume). Settings that cannot be zero (Opacity, Session Interval) no longer display the left notch.

### 3. Layout & Spacing
- **Horizontal Compactness**: Settings rows and the menu card have been tightened (reduced padding and gaps) to match the information density of the Benchmark Table.
- **Dot Track Spacing**: The gap between dots in the track increased from `0.2rem` to `0.25rem` for better visual clarity, while the notch-to-dot spacing was synchronized to the same value.

### 4. Placeholder Integration
- **Audio Suite**: Added a "Master Volume" slider as a placeholder for Phase 2.15 (SFX Identity). This slider serves as the reference implementation for the "Notch" UI, as volume is a setting that can be meaningfully set to zero.

## Implementation Details
- **CSS Updates**: `index.html` updated with `.settings-group`, `.settings-sub-rows`, and refined `.dot-track` / `.slider-notch` styles.
- **Component Logic**: `BenchmarkView.ts` refactored to use helper methods for appending specific setting groups (`_appendVisualizationSettings`, `_appendDotCloudGroup`, etc.).
- **VisualSettingsService**: Maintained as the source of truth for visibility toggles.

## Verifiable Outcome
- Settings menu is noticeably more compact.
- Dot tracks have slightly wider spacing (`0.25rem`).
- Disabling "Dot Cloud" hides its sub-settings with a slide-out effect.
- The "Master Volume" slider shows a notch; the "Dot Opacity" and "Session Interval" sliders do not.
- Clicking a dot in a track updates the selection pill instantly with no movement animation.
