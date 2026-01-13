# Current Commit: Merge 'ranked-runs-1' into 'ranked-runs-2'

## Changes
- Resolved all merge conflicts in:
  - `src/services/RankEstimator.ts`
  - `src/services/RankedSessionService.ts`
  - `src/services/__tests__/RankedSessionService.test.ts`
  - `src/components/BenchmarkView.ts`
  - `src/components/RankedView.ts`
  - `src/components/benchmark/BenchmarkRowRenderer.ts`
  - `src/components/__tests__/DifficultyPositionSync.test.ts`
  - `src/components/__tests__/RankUniformity.test.ts`
  - `src/components/__tests__/RankedViewLabels.test.ts`
  - `src/components/__tests__/RankPrecision.test.ts`

- **Standardized Naming Convention:**
  - Renamed `ScenarioRankEstimate` to `ScenarioEstimate` everywhere.
  - Renamed `getScenarioRankEstimate` to `getScenarioEstimate`.
  - Renamed `evolveScenarioRankEstimate` to `evolveScenarioEstimate`.
  - Renamed `getEstimateMap` to `getRankEstimateMap`.
  - Renamed CSS class `.estimate-badge` to `.rank-estimate-badge`.

- **Logic Integration:**
  - Integrated modular decay logic (`_processScenarioDecay`) from `ranked-runs-2` with the structural changes from `ranked-runs-1`.
  - Ensured `BenchmarkRowRenderer` and `RankedView` use the new `RankEstimator` API correctly.

- **Visual Fixes:**
  - Fixed syntax error in `src/styles/components.css` restoration.
  - Updated test mocks to include `showRanks: true` and `showRankEstimate: true` where missing.

## Status
- Build/Type check consistent.
- All 14 test suites passing (35 tests total).

