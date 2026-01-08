# Checkpoint 2.14.1 Architecture: Technical Debt Payoff II

## Overview
Continuing the technical debt payoff from checkpoint 2.14.0, this iteration focuses on decomposing the remaining large modules: `BenchmarkSettingsController.ts`, `DotCloudComponent.ts`, and `main.ts`. The goal is to enforce the sub-20-line method constraint and improve modularity by extracting UI factory logic, data processing, and application lifecycle management.

## Component Decomposition

### 1. Settings UI Architecture
To reduce the size of `BenchmarkSettingsController`, UI construction logic is moved to specialized factory and renderer classes.

- **`BenchmarkSettingsController`**: Acts as the coordinator between `VisualSettingsService`, `SessionSettingsService`, and the UI components.
- **`SettingsUIFactory`**: A utility class located in `src/components/ui/` that provides standardized methods for creating complex UI elements like `circle-checkbox` toggles, `dot-track` sliders, and segmented controls.
- **`SettingsSectionRenderer`**: Responsible for building specific groups (Visualization, Layout, Audio, Session), ensuring the controller remains focused on orchestration.

### 2. Visualization Architecture
The `DotCloudComponent` is split into logical units to separate data analysis from Canvas rendering.

- **`PerformanceScoreProcessor`**: Handles score filtering, outlier detection, and temporal sampling.
- **`RankUnitCoordinateMapper`**: Encapsulates the non-linear math required to map scores to uniform rank-unit distances and screen coordinates.
- **`DotCloudCanvasRenderer`**: A low-level renderer that takes processed coordinates and visual settings to perform the actual Canvas `draw` calls.
- **`DotCloudComponent`**: The public-facing component that orchestrates the data flow between the processor, mapper, and renderer.

### 3. Application Lifecycle Architecture
`main.ts` is slimmed down by extracting internal classes and orchestration logic.

- **`ApplicationStatusView`**: Extracted from `main.ts` into `src/components/ui/ApplicationStatusView.ts`. It handles the visual reporting of folder connectivity and scanning states.
- **`NavigationController`**: Manages the switching of views (Recent, New, Benchmarks) and persists the active tab state via `AppStateService`.
- **`AppBootstrap`**: A specialized routine for service instantiation and dependency wiring, leaving `main.ts` as a thin entry point.

## Data Flow & Interaction
1. **Settings**: User interacts with a control created by `SettingsUIFactory`. The callback triggers an update in the service via `BenchmarkSettingsController`. The service notifies subscribers, triggering a re-render.
2. **Visualization**: `DotCloudComponent` receives new scores. It passes them to `PerformanceScoreProcessor`. The result is given to `RankUnitCoordinateMapper` to determine Canvas positions. Finally, `DotCloudCanvasRenderer` paints the frame.
3. **App State**: `NavigationController` listens for UI clicks, updates `AppStateService`, and toggles the visibility of top-level view containers.

## Refactoring Constraints
- Every method must be strictly less than 20 lines.
- No comments; use self-explanatory naming for variables and functions.
- Private members must use the `_` prefix.
- All dependencies must be explicitly typed.