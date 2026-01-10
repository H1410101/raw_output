# Checkpoint 2.16.11 Architecture: Navigation Consolidation & Slider Polish

This checkpoint transitions the application to a focused benchmark-centric interface and refines the interactive behavior of settings components.

## 1. Dynamic Benchmark Configuration

The benchmark system has been decoupled from hardcoded difficulty levels.

- **File-Driven Tiers**: The DifficultyTier type is now a dynamic string. Tiers are derived directly from the filenames present in the benchmarks/ directory.
- **CSV Discovery**: The import.meta.glob pattern has been broadened to ../../benchmarks/*.csv.
- **Metadata Extraction**: The filename (minus extension) is used as the display name for the difficulty tab, allowing users to add or remove difficulties by simply managing files.

## 2. Navigation Simplification

The "Recent" and "New" views have been removed to streamline the user experience.

### UI Changes
- **Simplified Header**: The navigation menu now contains a primary "Benchmarks" button and a non-functional "Not Soon" placeholder.
- **Visual Identity**: Navigation buttons and difficulty tabs now share a unified design language with benchmark rows:
    - **Hover**: Subtle white highlight (rgba(255, 255, 255, 0.02)).
    - **Active/Selected**: Background tint using the lower-band palette (rgba(61, 82, 122, 0.1)).
    - **Border Removal**: Outlines have been removed in favor of background-based state indication.

### Code Cleanup
- **RecentRunsDisplay**: Removed from the codebase.
- **NavigationController**: Refactored to focus on benchmark view management.
- **AppBootstrap**: Stripped of legacy orchestration logic for the removed views.
- **RunIngestionService**: Simplified to only support background synchronization and session management without providing data for the removed list views.

## 3. Style Unification

- **Palette Integration**: Navigation and tab states now use semantic tokens from palette.css to ensure consistency across themes.
- **Interaction Logic**: The "Not Soon" item uses a default cursor and specific hover logic to indicate its upcoming/placeholder status while maintaining the "lower-band" typography style.

## 4. Slider Notch Animation & State Fix

The settings volume slider, which features a "left notch" for the 0% value, has been refined to fix animation direction and state persistence.

### Logical Indexing
- **`SettingsUiFactory`**: Refactored to use a consistent coordinate system for both internal and external notches. In notched sliders, the notch is assigned index `0`, and the dots in the track are shifted to indices `1...N`.

### Animation Wave Correction
- **Directionality**: Distance calculations now use the previous selection's logical index as the origin for the animation wave. This ensures that moving to the notch triggers a "collapse" toward the left, and moving from the notch triggers an "expand" toward the right.

### State Management
- **Notch Deactivation**: External notches only receive the `active` state when the value is exactly 0%. When a value > 0% is selected, the notch remains dim (dull), while dots to the left of the selection continue to "glow" according to standard track logic.