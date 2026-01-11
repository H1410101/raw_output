```raw_output\docs\checkpoints\phase 2\checkpoint 2.17.5 architecture.md#L1-45
# Checkpoint 2.17.5 Architecture: Dynamic Benchmark Ordering

Currently, benchmark difficulties are loaded from CSV files and sorted lexicographically. This results in an unintuitive order (e.g., "Easier", "Harder", "Medium"). This checkpoint introduces a numbering system for file-based benchmarks to enforce a logical progression while maintaining dynamic discovery.

## 1. Numbered Difficulty Discovery

The system will transition from pure name-based discovery to a prefix-aware system. Benchmark files in the `benchmarks/` directory will now follow a `[Priority] [Name].csv` convention.

- **Example**: `0 Easier.csv`, `1 Medium.csv`, `2 Harder.csv`.
- **Logic**: 
    - The `Priority` (integer) is used for sorting the tabs and internal maps.
    - The `Name` is extracted for UI display (labels, tags, etc.).
    - Files that do not follow the `[Number] [Space] [Name]` pattern will be ignored to ensure a consistent, predictable ordering across the application.

## 2. Technical Implementation

### `src/data/benchmarks.ts`
The data layer will be updated to handle the new naming convention:
- **`_extractTierNameFromFilePath`**: Updated to split the filename. It will validate the presence of a leading integer and a space.
- **`getAvailableDifficulties`**: The sorting logic will be updated to sort numerically based on the prefix before stripping it for the final return array, or the map itself will be keyed by the full name and sorted by prefix.
- **Display vs. ID**: The system will maintain the "Display Name" (stripped of the number) for the UI while using the "Full Name" or a stable ID for internal lookups to avoid collisions if two files have the same display name but different priorities.

### UI & Styling
- **Tab Rendering**: `BenchmarkView.ts` will continue to use the list from the service, which will now be correctly ordered.
- **Dynamic Tags**: The CSS classes for difficulty tags (e.g., `.tag-easier`) are currently hardcoded in `index.html`. The logic will be updated to generate a normalized class name from the display name (e.g., lowercase and stripped of spaces) to ensure compatibility with any new difficulty added (e.g., `0 Beginner.csv` -> `.tag-beginner`).

## 3. Data Integrity
- Benchmarks that are missing the numeric prefix will be logged as warnings in the console and excluded from the `BENCHMARK_MAP`. This enforces the "numbered system" proposed to fix the ordering issue once and for all.
