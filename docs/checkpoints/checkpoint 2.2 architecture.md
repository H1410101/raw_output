# Checkpoint 2.2: Benchmark View & Data Loading

## Purpose
Transition the application from a single-view dashboard to a multi-view interface capable of displaying benchmark-specific data. This includes a navigation system and an extended `BenchmarkService` to provide structured scenario data for the UI. The UI will be refined to support an "active area" layout with edge-to-edge structural elements.

## Architecture

### 1. Navigation & State Management
- **View Switching**: A simple state mechanism in `main.ts` to toggle between `Recent Runs` and `Benchmarks`.
- **UI Shell**: Update `index.html` to move navigation into the header and implement an edge-to-edge header design. The content will be centered in an "active area" restricted in width.

### 2. Benchmark Service Enhancements
- **Data Retrieval**: `BenchmarkService` will be extended to return full scenario objects (Name, Thresholds, etc.) instead of just difficulty strings.
- **Filtering**: Methods to retrieve scenarios filtered by `BenchmarkDifficulty`.

### 3. Benchmark Table Component
- **Component**: `BenchmarkTable.ts`
- **Responsibility**: Render a table of scenarios based on the active difficulty selection.
- **Structure**:
    - Scenario Name
    - Placeholder columns for Rank and Visualizations (to be populated in future checkpoints).
    - **Visual Style**: Rows separated by line dividers rather than individual glass cards.

### 4. Component Hierarchy
- `App` (main.ts)
    - `Header` (Navigation, Logo, Status)
    - `Active Area` (Centered Container)
        - `RecentRunsDisplay` (Existing)
        - `BenchmarkView` (New)
            - `DifficultySelector`
            - `BenchmarkTable`

## Data Flow
1. User clicks "Benchmarks" in the sidebar.
2. Application state updates to show the Benchmark View.
3. `BenchmarkView` requests scenarios for the default difficulty (e.g., "Easier") from `BenchmarkService`.
4. `BenchmarkService` parses CSV data via `benchmarks.ts` and returns scenario lists.
5. `BenchmarkTable` renders the list into the DOM.