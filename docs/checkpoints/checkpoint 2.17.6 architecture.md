# Checkpoint 2.17.6 Architecture: Margin Spacing & Dashboard Fitting

This checkpoint focuses on improving the spatial utilization of the application by making the main dashboard panel fill its parent container and introducing a "Margin Spacing" setting to control both external and internal density. It also refines the scrollbar's "hole-in-glass" aesthetic to respond dynamically to these spacing changes.

## 1. Unified Density Control

The "Margin Spacing" setting acts as a primary controller for the whitespace distribution across the UI, separating "layout breathing room" from the "vertical content density" managed by the existing Vertical Spacing setting.

### `VisualSettingsService` & `ScalingService`
- **`marginSpacing`**: A new property added to `VisualSettings` of type `ScalingLevel`.
- **`--margin-spacing-multiplier`**: A CSS variable mapped to the `marginSpacing` setting, allowing for fluid adjustments of paddings and margins across the stylesheet.

### `SettingsSectionRenderer`
- **Control Placement**: A new segmented control for "Margin Spacing" is inserted at the top of the "Layout Scaling" sub-rows, providing immediate visual feedback for the most impactful layout setting.

## 2. Dashboard Structural Changes

The `.dashboard-panel` is transitioned from a centered, content-sized box to a container that fills the available space provided by the `#app` mount point, while maintaining external breathing room via margins.

- **`#app`**: Acts as a flex container ensuring children (like the dashboard) expand to fill the viewport height minus the header.
- **`.dashboard-panel`**: Now uses `flex: 1` and a `margin` of `1.5rem * var(--margin-spacing-multiplier)` on the left, right, and bottom. This creates a distinct gutter between the panel border and the `#app` container boundaries.

## 3. The "Hole-in-Glass" Mechanism

The aesthetic effect relies on a large `box-shadow` spread that covers the entire container except for a specific "cut-out" area reserved for the scrollbar track. For this to work, the container must be transparent and isolated.

### CSS Implementation
- **Container Isolation**: The `.benchmark-table-container` now explicitly sets `background: transparent` and `isolation: isolate`. This ensures that its background does not cover the "hole" created by the pseudo-element and that the pseudo-element's negative `z-index` stays within the container's stacking context.
- **Shadow Casting**: The `::before` pseudo-element uses a `200vw` spread `box-shadow` with the color `rgba(var(--background-2-rgb), 0.2375)`. This effectively provides the "pane" color while leaving its own dimensions (the track area) completely clear.

## 4. Propagation of Margin Scaling

The `--margin-spacing-multiplier` is applied to several key areas to ensure visual consistency and perfect spatial alignment between the background "cut-out" and the functional scrollbar.

### Layout & Component Scaling
- **External Gutter**: The padding of `.container` (the main app wrapper) scales with margin settings.
- **Main Header**: Horizontal and vertical padding of `.app-header` and its bottom margin.
- **Glass Panes**: The internal padding of the main dashboard panel and the settings menu card.
- **Table Controls**: The spacing around difficulty tabs and the margin between header controls and the benchmark table.
- **Component Specifics**: 
    - Internal padding of `.run-item` and `.scenario-row`.
    - Spacing within the Folder Settings view (column gaps and intro text padding).
    - Corner radii (`.pane-container`, `.run-item`) to match the scaled margin borders.
    - **Scenario Name Width**: The `ScenarioNameWidthManager` now uses the margin multiplier for its horizontal padding calculations.

## 5. Horizontal Spacing & Scrollbar Refinement

To provide more visual breathing room and exact numerical symmetry, the scrollbar area has been refined beyond its initial implementation.

- **Balanced Gaps**: The space on both sides of the scrollbar is now fixed at **0.75rem** (scaled). 
- **Native Scrollbar Removal**: The native browser scrollbar width is set to **0** via `::-webkit-scrollbar { width: 0 }`. This ensures that the benchmark rows extend exactly to the boundary of our custom margin, preventing invisible scrollbar buffers from skewing the layout symmetry.
- **Proportional Scaling**: The **0.5rem** width of the scrollbar itself is now scaled by the `--margin-spacing-multiplier`, ensuring the entire 2.0rem "scroll zone" (0.75 margin + 0.5 thumb + 0.75 gutter) remains proportional at all scaling levels.
- **Vertical Breathing Room**: While horizontal gaps are tighter, the top and bottom margins are maintained at **1.5rem** to provide adequate vertical separation from the pane boundaries.

## 6. Interaction Logic: Hover-Meet

The scrollbar interaction has been transitioned from an auto-scroll loop to a direct, mouse-driven "hover-meet" mechanism.

- **Edge-Meeting Logic**: Instead of the thumb "jumping" to center on the cursor, the nearest edge of the thumb now shifts to meet the cursor's vertical position. This is implemented via direct pixel delta calculations rather than speed-based loops.
- **Dynamic Hitboxes**: Hitboxes extending 10% of the thumb height above and below the thumb act as the trigger zones for this following behavior.
- **Cursor Stability**: The hover container's cursor is set to `pointer` whenever the mouse is horizontally aligned with the scrollbar, preventing flickering between the hand and default cursor during rapid vertical movement.
- **Direct Scroll Integration**: The logic bypasses animation timers and directly adjusts the `scrollTop` of the container based on the mouse's relative vertical position when in the trigger zones.
- **Visual Consistency**: This ensures that regardless of the user's "Margin Spacing" preference, the scrollbar thumb slides perfectly through the "cut-out" in the glass background with balanced symmetry.