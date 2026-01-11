# Checkpoint 2.3: Benchmark Categories & Layout - Architecture

## Data Layer Refinement
The benchmark data structure has been expanded to include categorization metadata. The `BenchmarkScenario` interface now explicitly tracks the hierarchy:

```typescript
export interface BenchmarkScenario {
  category: string;
  subcategory: string;
  name: string;
  thresholds: Record<string, number>;
}
```

The `BenchmarkService` and `benchmarks.ts` data layer now handle these objects, allowing the UI to access grouping metadata without additional lookups. The `extract_ranks.cjs` script was modified to preserve this metadata during CSV parsing.

## UI Component Architecture
The `BenchmarkView` was refactored to handle hierarchical rendering.

### Grouping Logic
A private helper `_groupScenarios` converts the flat array of scenarios into a nested Map structure:
`Map<Category, Map<Subcategory, BenchmarkScenario[]>>`. 
This allows the render loop to iterate through categories, then subcategories, then scenarios, ensuring a clean DOM structure.

### Component Breakdown
1.  **Category Group**: A top-level container that houses a vertical category label and a container for its subcategories.
2.  **Subcategory Group**: A nested container within a category that houses a vertical subcategory label and the list of individual scenario rows.
3.  **Vertical Labels**: Implemented using CSS writing modes to rotate text anticlockwise. 
    - **Category Labels**: Dynamically centered within the visible viewport using JavaScript. As the user scrolls through a large category, the label "follows" the scroll to remain visible and centered.
    - **Subcategory Labels**: Vertically centered within their specific subcategory container using CSS positioning.

## Styling & Layout
The layout uses a Flexbox-based nesting strategy:
- **`benchmark-category-group`**: `display: flex`. The category label and subcategory container sit side-by-side.
- **`benchmark-subcategory-group`**: `display: flex`. The subcategory label and scenario list sit side-by-side.
- **`vertical-text`**: 
    - `writing-mode: vertical-rl` for vertical orientation.
    - `transform: translate(-50%, -50%) rotate(180deg)` with `top: 50%; left: 50%` to ensure text is perfectly centered within its track and reads from top to bottom.
    - `white-space: nowrap` to prevent wrapping within the narrow vertical gutters.

This structure provides a clear visual anchor for the user, allowing them to scan by category (e.g., "Flick Tech") and subcategory (e.g., "Evasive") before looking at specific scenario names.