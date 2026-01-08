# Checkpoint 2.14.0 Architecture: BenchmarkView Refactoring

## Overview
The `BenchmarkView.ts` file currently exceeds 1300 lines, encompassing state management, UI rendering, complex scroll logic, and settings management. This refactor splits the monolithic class into specialized components and controllers to improve maintainability and adhere to the project's coding standards.

## Component Decomposition

### 1. BenchmarkView (Main Entry)
- **Role**: Orchestrator.
- **Responsibilities**: Subscribing to services, managing high-level view state (active difficulty), and delegating rendering to sub-components.
- **Path**: `src/components/BenchmarkView.ts`

### 2. BenchmarkSettingsController
- **Role**: UI Logic for the Settings Menu.
- **Responsibilities**: Creating the settings overlay, groups, toggles, sliders, and segmented controls. It interacts directly with `VisualSettingsService` and `SessionSettingsService`.
- **Path**: `src/components/benchmark/BenchmarkSettingsController.ts`

### 3. BenchmarkTableComponent
- **Role**: Specialized Table Renderer.
- **Responsibilities**: Constructing the table structure, category/subcategory grouping, and managing the scenario rows.
- **Path**: `src/components/benchmark/BenchmarkTableComponent.ts`

### 4. BenchmarkScrollController
- **Role**: Interaction Logic.
- **Responsibilities**: Handling the custom scroll track, tactile thumb sync, drag-to-scroll, and auto-scroll hover logic.
- **Path**: `src/components/benchmark/BenchmarkScrollController.ts`

### 5. BenchmarkLabelPositioner
- **Role**: Layout Helper.
- **Responsibilities**: Implementing the "sticky centering" logic for vertical category labels during scroll events.
- **Path**: `src/components/benchmark/BenchmarkLabelPositioner.ts`

### 6. BenchmarkRowRenderer
- **Role**: Micro-component.
- **Responsibilities**: Rendering individual scenario rows, badges, and the play button.
- **Path**: `src/components/benchmark/BenchmarkRowRenderer.ts`

## Data Flow
1. `BenchmarkView` receives service updates.
2. `BenchmarkView` triggers `render()`.
3. `BenchmarkTableComponent` generates the DOM nodes.
4. `BenchmarkScrollController` attaches to the generated table container.
5. `BenchmarkLabelPositioner` is initialized to handle scroll-driven layout shifts.
6. User interactions in `BenchmarkSettingsController` update services, which propagate back to `BenchmarkView`.

## Refactoring Constraints
- All methods must be strictly less than 20 lines.
- Private methods must be prefixed with `_`.
- Use descriptive variable and class names.
- Maintain existing visual and functional behavior exactly.
